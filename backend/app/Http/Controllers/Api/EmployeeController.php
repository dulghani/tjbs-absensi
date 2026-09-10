<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Employee;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $query = Employee::with(['company:id,name', 'division:id,name']);

        if ($request->company_id && $request->company_id !== 'all') $query->where('company_id', $request->company_id);

        // Filter divisi: 'null' = karyawan tanpa divisi, UUID = filter by divisi tertentu
        if ($request->division_id) {
            if ($request->division_id === 'null') $query->whereNull('division_id');
            elseif ($request->division_id !== 'all') $query->where('division_id', $request->division_id);
        }

        // Filter departemen: 'null' = karyawan tanpa departemen, string lain = filter by dept
        if ($request->department) {
            if ($request->department === 'null') $query->where(fn ($q) => $q->whereNull('department')->orWhere('department', ''));
            elseif ($request->department !== 'all') $query->where('department', $request->department);
        }

        if ($request->status && $request->status !== 'all') $query->where('status', $request->status);
        if ($request->search) {
            $s = $request->search;
            $query->where(fn ($q) => $q->whereLike('name', "%{$s}%")->orWhereLike('nik', "%{$s}%"));
        }

        return response()->json(['data' => $query->orderBy('name')->paginate($request->per_page ?? 50)]);
    }

    public function show(string $id)
    {
        return response()->json(['data' => Employee::with(['company', 'currentAssignment'])->findOrFail($id)]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'division_id' => 'nullable|uuid|exists:divisions,id',
            'nik' => 'nullable|string|max:30',
            'name' => 'required|string|max:255',
            'gender' => 'nullable|in:L,P',
            'department' => 'nullable|string|max:255',
            'line' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:255',
            'employment_status' => 'nullable|in:probation,permanent,contract,temporary',
            'join_date' => 'required|date',
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string',
            'ktp_number' => 'nullable|string|max:20',
        ]);

        $employee = Employee::create($data + ['status' => 'active']);
        AuditLog::record(['company_id' => $employee->company_id, 'action_category' => 'create', 'entity_type' => 'employee', 'entity_id' => $employee->id, 'entity_name' => $employee->name, 'changes_summary' => 'Menambahkan karyawan baru']);

        return response()->json(['data' => $employee], 201);
    }

    public function update(Request $request, string $id)
    {
        $employee = Employee::findOrFail($id);
        $old = $employee->only(array_keys($request->all()));

        $data = $request->validate([
            'nik' => 'nullable|string|max:30',
            'name' => 'sometimes|string|max:255',
            'gender' => 'nullable|in:L,P',
            'division_id' => 'nullable|uuid|exists:divisions,id',
            'department' => 'nullable|string|max:255',
            'line' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:255',
            'employment_status' => 'nullable|in:probation,permanent,contract,temporary',
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string',
            'status' => 'nullable|in:active,inactive',
        ]);

        $employee->update($data);
        AuditLog::record(['company_id' => $employee->company_id, 'action_category' => 'update', 'entity_type' => 'employee', 'entity_id' => $employee->id, 'entity_name' => $employee->name, 'old_values' => $old, 'new_values' => $data]);

        return response()->json(['data' => $employee]);
    }

    /** Aktifkan atau nonaktifkan karyawan. Saat nonaktif, end_date wajib diisi. */
    public function toggleStatus(Request $request, string $id)
    {
        $employee = Employee::findOrFail($id);
        $isActive = $employee->status === 'active';

        if ($isActive) {
            // Nonaktifkan — end_date wajib
            $data = $request->validate([
                'end_date' => 'required|date',
                'notes'    => 'nullable|string|max:255',
            ]);
            $employee->update([
                'status'   => 'inactive',
                'end_date' => $data['end_date'],
            ]);
        } else {
            // Aktifkan kembali — hapus end_date
            $employee->update([
                'status'   => 'active',
                'end_date' => null,
            ]);
        }

        AuditLog::record([
            'company_id'    => $employee->company_id,
            'action_category' => 'update',
            'entity_type'   => 'employee',
            'entity_id'     => $employee->id,
            'entity_name'   => $employee->name,
            'changes_summary' => $isActive ? "Nonaktifkan per {$employee->end_date}" : 'Aktifkan kembali',
        ]);

        return response()->json(['data' => $employee->fresh()]);
    }

    public function destroy(string $id)
    {
        $employee = Employee::findOrFail($id);
        AuditLog::record(['company_id' => $employee->company_id, 'action_category' => 'delete', 'entity_type' => 'employee', 'entity_id' => $employee->id, 'entity_name' => $employee->name]);
        $employee->delete();

        return response()->json(['success' => true]);
    }

    /** Hapus banyak karyawan sekaligus — dipakai fitur "pilih beberapa lalu hapus" di UI. */
    public function bulkDestroy(Request $request)
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'uuid|exists:employees,id',
        ]);

        $employees = Employee::whereIn('id', $data['ids'])->get(['id', 'name', 'company_id']);

        foreach ($employees as $employee) {
            AuditLog::record(['company_id' => $employee->company_id, 'action_category' => 'delete', 'entity_type' => 'employee', 'entity_id' => $employee->id, 'entity_name' => $employee->name, 'changes_summary' => 'Bulk delete']);
        }

        Employee::whereIn('id', $data['ids'])->delete();

        return response()->json(['success' => true, 'deleted' => $employees->count()]);
    }

    /** Daftar departemen unik, dipakai buat dropdown filter di halaman lain (Absensi, dll). */
    public function departments(Request $request)
    {
        $query = Employee::query();
        if ($request->company_id && $request->company_id !== 'all') {
            $query->where('company_id', $request->company_id);
        }
        if ($request->division_id && $request->division_id !== 'all') {
            $query->where('division_id', $request->division_id);
        }
        $departments = $query->whereNotNull('department')->where('department', '!=', '')
            ->distinct()->orderBy('department')->pluck('department');

        return response()->json(['data' => $departments]);
    }

    /**
     * Daftar divisi yang benar-benar terpakai di data karyawan.
     * Sama dengan pendekatan filter departemen — sumber dari tabel employees,
     * bukan dari tabel divisions. Ini memastikan dropdown hanya tampilkan
     * divisi yang ada karyawannya.
     */
    public function divisionList(Request $request)
    {
        $query = Employee::with('division:id,name')
            ->whereNotNull('division_id')
            ->select('division_id');

        if ($request->company_id && $request->company_id !== 'all') {
            $query->where('company_id', $request->company_id);
        }

        $divisions = $query->distinct()
            ->get()
            ->map(fn ($e) => $e->division)
            ->filter()
            ->unique('id')
            ->sortBy('name')
            ->values();

        return response()->json(['data' => $divisions]);
    }

    /** Autocomplete karyawan — untuk form lembur, absensi manual, dll.
     *  Filter by company, division, department, status. Max 50 hasil. */
    public function search(Request $request)
    {
        $q = $request->q;
        $query = Employee::with(['division:id,name'])
            ->where('status', 'active')
            ->select('id', 'nik', 'name', 'department', 'position', 'division_id', 'company_id');

        if ($request->company_id && $request->company_id !== 'all') {
            $query->where('company_id', $request->company_id);
        }
        if ($request->division_id && $request->division_id !== 'all') {
            $query->where('division_id', $request->division_id);
        }
        if ($request->department && $request->department !== 'all') {
            $query->where('department', $request->department);
        }
        if ($q) {
            $query->where(fn ($s) => $s->where('name', 'like', "%{$q}%")->orWhere('nik', 'like', "%{$q}%"));
        }

        return response()->json(['data' => $query->orderBy('name')->limit(50)->get()]);
    }

    /** Download template Excel untuk import karyawan Fingerspot. */
    public function downloadTemplate()
    {
        // Kembalikan JSON — SheetJS di frontend yang generate xlsx-nya
        // supaya tidak perlu PhpSpreadsheet untuk membuat file dari backend
        return response()->json([
            'headers' => ['ID', 'NIK', 'Nama di perangkat absensi', 'Nama Depan', 'Nama Belakang', 'Jenis Kelamin', 'Tanggal Bergabung', 'Kantor', 'Jabatan', 'WhatsApp'],
            'example' => [['635', '635', 'ABD HAMID', 'ABD', 'HAMID', 'L', '2026-04-28', 'WIN JATAYU', 'BLANKING', '08123456789']],
            'notes' => [
                'ID' => 'PIN mesin fingerprint (wajib)',
                'NIK' => 'NIK karyawan (boleh sama dengan ID)',
                'Nama Depan' => 'Nama depan karyawan (wajib)',
                'Nama Belakang' => 'Nama belakang (boleh kosong)',
                'Jenis Kelamin' => 'L atau P',
                'Tanggal Bergabung' => 'Format YYYY-MM-DD',
                'Kantor' => 'Nama divisi di sistem (WIN JATAYU, WIN ITE, dll)',
                'Jabatan' => 'Kode departemen (BLANKING, INJECT, ITE, dll)',
                'WhatsApp' => 'Nomor HP dengan kode negara (opsional)',
            ],
        ]);
    }

    /**
     * Export daftar karyawan ke format JSON yang siap dipakai SheetJS di frontend.
     */
    public function export(Request $request)
    {
        $query = Employee::with('company:id,name')->where('status', 'active');

        if ($request->company_id && $request->company_id !== 'all') {
            $query->where('company_id', $request->company_id);
        }
        if ($request->department && $request->department !== 'all') {
            $query->where('department', $request->department);
        }

        $employees = $query->orderBy('name')->get();

        $rows = $employees->map(fn ($e) => [
            'NIK'            => $e->nik,
            'Nama'           => $e->name,
            'Perusahaan'     => $e->company?->name,
            'Departemen'     => $e->department,
            'Jabatan'        => $e->position,
            'Status'         => $e->employment_status,
            'Tanggal Masuk'  => $e->join_date?->format('Y-m-d'),
            'No HP'          => $e->phone,
        ]);

        return response()->json(['data' => $rows]);
    }
}
