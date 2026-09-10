<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeaveRequest;
use App\Models\AttendanceSummary;
use App\Models\AttendanceLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LeaveController extends Controller
{
    /** Status label ke attendance_status */
    const STATUS_MAP = [
        'not_present' => 'on_leave',
        'late'        => 'present',   // tetap present tapi late_minutes = 0 (izin)
        'early_leave' => 'present',   // tetap present
    ];

    public function index(Request $request)
    {
        $q = LeaveRequest::with(['employee:id,name,nik,department', 'approvedBy:id,name'])
            ->latest('leave_date');

        if ($request->company_id && $request->company_id !== 'all')
            $q->where('company_id', $request->company_id);
        if ($request->status && $request->status !== 'all')
            $q->where('status', $request->status);
        if ($request->leave_type && $request->leave_type !== 'all')
            $q->where('leave_type', $request->leave_type);
        if ($request->from_date) $q->whereDate('leave_date', '>=', $request->from_date);
        if ($request->to_date)   $q->whereDate('leave_date', '<=', $request->to_date);
        if ($request->employee_id) $q->where('employee_id', $request->employee_id);

        return response()->json(['data' => $q->paginate($request->per_page ?? 25)]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'company_id'  => 'required|uuid|exists:companies,id',
            'employee_id' => 'required|uuid|exists:employees,id',
            'leave_type'  => 'required|in:not_present,late,early_leave',
            'leave_date'  => 'required|date',
            'actual_time' => ['nullable', function ($attr, $val, $fail) {
                if ($val === null || $val === '') return;
                // Terima H:i (09:00) dan H:i:s (09:00:00) dan H:i A (09:00 AM)
                $parsed = null;
                foreach (['H:i', 'H:i:s', 'g:i A', 'g:i:s A', 'h:i A', 'h:i:s A'] as $fmt) {
                    $dt = \DateTime::createFromFormat($fmt, $val);
                    if ($dt) { $parsed = $dt->format('H:i'); break; }
                }
                if (! $parsed) $fail("Format jam tidak valid. Gunakan format HH:MM (contoh: 09:00).");
            }],
            'reason'      => 'required|string|max:500',
            'notes'       => 'nullable|string|max:1000',
        ]);

        // Normalisasi actual_time ke H:i
        if (! empty($data['actual_time'])) {
            foreach (['H:i', 'H:i:s', 'g:i A', 'g:i:s A', 'h:i A', 'h:i:s A'] as $fmt) {
                $dt = \DateTime::createFromFormat($fmt, $data['actual_time']);
                if ($dt) { $data['actual_time'] = $dt->format('H:i'); break; }
            }
        }

        // Cek duplikat
        $exists = LeaveRequest::where('employee_id', $data['employee_id'])
            ->where('leave_date', $data['leave_date'])
            ->where('leave_type', $data['leave_type'])
            ->whereIn('status', ['pending','approved'])
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'Sudah ada pengajuan izin untuk karyawan dan tanggal ini.'], 422);
        }

        $leave = LeaveRequest::create($data + ['submitted_by' => $request->user()->id]);

        return response()->json(['data' => $leave->load(['employee:id,name,nik,department'])], 201);
    }

    public function approve(Request $request, string $id)
    {
        $user = $request->user();
        $role = $user->role ?? ($user->roles[0] ?? '');
        abort_unless(in_array($role, ['hrd','coordinator','super_admin']), 403, 'Tidak berwenang menyetujui izin.');

        $leave = LeaveRequest::with('employee')->findOrFail($id);

        if (in_array($leave->status, ['approved', 'rejected'])) {
            return response()->json(['message' => 'Izin ini sudah diproses sebelumnya.'], 422);
        }

        $leave->update([
            'status'      => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'notes'       => $request->notes ?? null,
        ]);

        // Update attendance_summary sesuai tipe izin
        $this->applyToAttendance($leave);

        // Kirim email notifikasi ke karyawan (jika ada email)
        try {
            $emp = $leave->employee;
            $userAkun = \App\Models\User::where('company_id', $leave->company_id)
                ->where('name', 'like', "%{$emp->name}%")->first();
            if ($userAkun) $userAkun->notify(new \App\Notifications\LeaveStatusNotification($leave->fresh()));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Email notifikasi izin gagal: ' . $e->getMessage());
        }

        return response()->json(['data' => $leave->fresh()->load(['employee:id,name,nik,department', 'approvedBy:id,name'])]);
    }

    public function reject(Request $request, string $id)
    {
        $user = $request->user();
        $role = $user->role ?? ($user->roles[0] ?? '');
        abort_unless(in_array($role, ['hrd','coordinator','super_admin']), 403, 'Tidak berwenang menolak izin.');

        $leave = LeaveRequest::findOrFail($id);

        if (in_array($leave->status, ['approved', 'rejected'])) {
            return response()->json(['message' => 'Izin ini sudah diproses sebelumnya.'], 422);
        }

        $leave->update([
            'status'      => 'rejected',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'notes'       => $request->notes ?? 'Ditolak oleh ' . $request->user()->name,
        ]);

        return response()->json(['data' => $leave->fresh()]);
    }

    public function destroy(string $id)
    {
        $leave = LeaveRequest::findOrFail($id);
        if ($leave->status === 'approved') {
            return response()->json(['message' => 'Izin yang sudah disetujui tidak dapat dihapus.'], 422);
        }
        $leave->delete();
        return response()->json(['success' => true]);
    }

    /** Update attendance_summary setelah izin diapprove */
    private function applyToAttendance(LeaveRequest $leave): void
    {
        $date    = $leave->leave_date->format('Y-m-d');
        $empId   = $leave->employee_id;
        $summary = AttendanceSummary::where('employee_id', $empId)
            ->where('attendance_date', $date)->first();

        try {
            switch ($leave->leave_type) {
                case 'not_present':
                    // Tandai sebagai on_leave (bukan absent biasa)
                    if ($summary) {
                        $summary->update(['attendance_status' => 'on_leave', 'notes' => 'Izin tidak masuk: ' . $leave->reason]);
                    } else {
                        // Buat summary jika belum ada (karyawan memang tidak masuk)
                        AttendanceSummary::create([
                            'employee_id'       => $empId,
                            'company_id'        => $leave->company_id,
                            'attendance_date'   => $date,
                            'attendance_status' => 'on_leave',
                            'notes'             => 'Izin tidak masuk: ' . $leave->reason,
                        ]);
                    }
                    break;

                case 'late':
                    // Reset late_minutes ke 0 — dianggap izin terlambat
                    if ($summary) {
                        $summary->update(['late_minutes' => 0, 'notes' => 'Izin terlambat: ' . $leave->reason]);
                    }
                    // Jika actual_time diberikan, inject log masuk manual
                    if ($leave->actual_time) {
                        AttendanceLog::firstOrCreate(
                            ['employee_id' => $empId, 'logged_time' => $date . ' ' . $leave->actual_time . ':00', 'log_type' => 'manual_entry'],
                            ['company_id' => $leave->company_id, 'notes' => 'Izin terlambat — masuk jam ' . $leave->actual_time]
                        );
                        // Recalculate
                        $calc = app(\App\Services\Attendance\AttendanceCalculationService::class);
                        $calc->calculateForEmployeeDate($empId, $date);
                    }
                    break;

                case 'early_leave':
                    // Reset early_leave / ubah catatan
                    if ($summary) {
                        $summary->update(['notes' => 'Izin pulang cepat: ' . $leave->reason]);
                    }
                    // Jika actual_time (jam pulang) diberikan, inject log
                    if ($leave->actual_time) {
                        AttendanceLog::firstOrCreate(
                            ['employee_id' => $empId, 'logged_time' => $date . ' ' . $leave->actual_time . ':00', 'log_type' => 'manual_entry'],
                            ['company_id' => $leave->company_id, 'notes' => 'Izin pulang cepat — keluar jam ' . $leave->actual_time]
                        );
                        $calc = app(\App\Services\Attendance\AttendanceCalculationService::class);
                        $calc->calculateForEmployeeDate($empId, $date);
                    }
                    break;
            }
        } catch (\Throwable $e) {
            Log::error('applyToAttendance gagal', ['leave_id' => $leave->id, 'error' => $e->getMessage()]);
        }
    }
}
