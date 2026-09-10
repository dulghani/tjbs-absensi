<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceLog;
use App\Models\AttendanceSummary;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function checkIn(Request $request)
    {
        $data = $request->validate([
            'employee_id' => 'required|uuid|exists:employees,id',
            'line_id' => 'nullable|uuid',
            'biometric_type' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $employee = Employee::findOrFail($data['employee_id']);

        $log = AttendanceLog::create($data + [
            'company_id' => $employee->company_id,
            'log_type' => 'check_in',
            'logged_time' => now(),
            'verification_status' => 'auto',
        ]);

        return response()->json(['status' => 'success', 'message' => 'Check-in recorded', 'data' => $log]);
    }

    public function checkOut(Request $request)
    {
        $data = $request->validate([
            'employee_id' => 'required|uuid|exists:employees,id',
            'line_id' => 'nullable|uuid',
        ]);

        $employee = Employee::findOrFail($data['employee_id']);

        $log = AttendanceLog::create($data + [
            'company_id' => $employee->company_id,
            'log_type' => 'check_out',
            'logged_time' => now(),
            'verification_status' => 'auto',
        ]);

        return response()->json(['status' => 'success', 'message' => 'Check-out recorded', 'data' => $log]);
    }

    public function summaries(Request $request)
    {
        $query = AttendanceSummary::with(['employee:id,name,department', 'employee.deviceMappings:id,employee_id,device_pin']);

        if ($request->employee_id) $query->where('employee_id', $request->employee_id);
        if ($request->company_id && $request->company_id !== 'all') $query->where('company_id', $request->company_id);
        if ($request->from_date) $query->where('attendance_date', '>=', $request->from_date);
        if ($request->to_date) $query->where('attendance_date', '<=', $request->to_date);
        if ($request->status && $request->status !== 'all') $query->where('attendance_status', $request->status);
        if ($request->department && $request->department !== 'all') {
            $query->whereHas('employee', fn ($q) => $q->where('department', $request->department));
        }
        if ($request->name) {
            $q = $request->name;
            $query->where(function ($sub) use ($q) {
                $sub->whereHas('employee', fn ($e) => $e->where('name', 'like', "%{$q}%"))
                    ->orWhereHas('employee.deviceMappings', fn ($e) => $e->where('device_pin', 'like', "%{$q}%"));
            });
        }

        // Sorting: whitelist kolom yang boleh di-sort supaya tidak bisa disuntik nama kolom sembarang.
        $sortable = ['attendance_date', 'actual_start_time', 'actual_end_time', 'productive_work_minutes', 'overtime_minutes', 'attendance_status'];
        $sortBy = in_array($request->sort_by, $sortable, true) ? $request->sort_by : 'attendance_date';
        $sortDir = $request->sort_dir === 'asc' ? 'asc' : 'desc';

        return response()->json(['data' => $query->orderBy($sortBy, $sortDir)->orderByDesc('attendance_date')->paginate($request->per_page ?? 200)]);
    }

    /**
     * Statistik Hadir/Terlambat/Absen/Cuti untuk SELURUH data yang cocok filter (bukan cuma
     * halaman yang sedang tampil) — dipakai kartu ringkasan di atas tabel Absensi supaya
     * angkanya tetap akurat meski tabelnya dipaginasi.
     */
    public function summaryStats(Request $request)
    {
        $query = AttendanceSummary::query();

        if ($request->company_id && $request->company_id !== 'all') $query->where('company_id', $request->company_id);
        if ($request->from_date) $query->where('attendance_date', '>=', $request->from_date);
        if ($request->to_date) $query->where('attendance_date', '<=', $request->to_date);
        if ($request->department && $request->department !== 'all') {
            $query->whereHas('employee', fn ($q) => $q->where('department', $request->department));
        }

        $counts = (clone $query)->selectRaw('attendance_status, count(*) as jumlah')->groupBy('attendance_status')->pluck('jumlah', 'attendance_status');

        // Hitung lembur terkonfirmasi & belum terkonfirmasi untuk kartu ringkasan baru
        $overtimeVerified   = (clone $query)->where('overtime_minutes', '>', 0)->where('overtime_verified', true)->count();
        $overtimeUnverified = (clone $query)->where('overtime_minutes', '>', 0)->where('overtime_verified', false)->count();

        return response()->json(['data' => [
            'present'             => $counts->get('present', 0) + $counts->get('late', 0) + $counts->get('early_leave', 0),
            'late'                => $counts->get('late', 0),
            'absent'              => $counts->get('absent', 0),
            'on_leave'            => $counts->get('on_leave', 0),
            'incomplete'          => $counts->get('incomplete', 0),
            'overtime_verified'   => $overtimeVerified,
            'overtime_unverified' => $overtimeUnverified,
        ]]);
    }

    public function daily(string $employeeId, string $date)
    {
        $summary = AttendanceSummary::with('employee')
            ->where('employee_id', $employeeId)
            ->where('attendance_date', $date)
            ->first();

        return response()->json(['data' => $summary]);
    }

    public function analytics(string $employeeId, int $month, int $year)
    {
        $summaries = AttendanceSummary::where('employee_id', $employeeId)
            ->whereMonth('attendance_date', $month)
            ->whereYear('attendance_date', $year)
            ->get();

        return response()->json(['data' => [
            'total_days_in_period' => $summaries->count(),
            'days_present' => $summaries->whereIn('attendance_status', ['present', 'late'])->count(),
            'days_absent' => $summaries->where('attendance_status', 'absent')->count(),
            'days_late' => $summaries->where('attendance_status', 'late')->count(),
            'days_on_leave' => $summaries->where('attendance_status', 'on_leave')->count(),
            'total_work_hours' => round($summaries->sum('productive_work_minutes') / 60, 2),
            'total_overtime_hours' => round($summaries->sum('overtime_minutes') / 60, 2),
            'attendance_percentage' => $summaries->count() ? round($summaries->whereIn('attendance_status', ['present', 'late'])->count() / $summaries->count() * 100, 1) : 0,
        ]]);
    }

    // ── Leave ─────────────────────────────────────────────────────────────────
    public function leaveTypes(string $companyId)
    {
        return response()->json(['data' => LeaveType::where('company_id', $companyId)->where('status', 'active')->get()]);
    }

    public function storeLeaveRequest(Request $request)
    {
        $data = $request->validate([
            'employee_id' => 'required|uuid|exists:employees,id',
            'leave_type_id' => 'nullable|uuid|exists:leave_types,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'nullable|string',
        ]);

        $employee = Employee::findOrFail($data['employee_id']);
        $leave = LeaveRequest::create($data + ['company_id' => $employee->company_id, 'status' => 'submitted']);

        return response()->json(['data' => $leave], 201);
    }

    public function approveLeaveRequest(Request $request, string $id)
    {
        $leave = LeaveRequest::findOrFail($id);
        $leave->update(['status' => 'approved', 'approved_by' => $request->user()->id, 'approved_at' => now()]);

        // Tandai setiap hari dalam rentang cuti sebagai 'on_leave' di attendance_summaries.
        $cursor = \Carbon\Carbon::parse($leave->start_date);
        $end = \Carbon\Carbon::parse($leave->end_date);
        while ($cursor->lte($end)) {
            AttendanceSummary::updateOrCreate(
                ['employee_id' => $leave->employee_id, 'attendance_date' => $cursor->format('Y-m-d')],
                ['company_id' => $leave->company_id, 'attendance_status' => 'on_leave', 'expected_work_minutes' => 0, 'status' => 'auto_finalized']
            );
            $cursor->addDay();
        }

        return response()->json(['data' => $leave]);
    }

    /**
     * Hitung ulang attendance summary untuk semua karyawan aktif dalam rentang tanggal.
     * Berjalan sebagai job di queue supaya tidak timeout saat range panjang.
     */
    public function recalculate(Request $request)
    {
        $data = $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'from_date'  => 'required|date',
            'to_date'    => 'required|date|after_or_equal:from_date',
        ]);

        $from = \Carbon\Carbon::parse($data['from_date']);
        $to   = \Carbon\Carbon::parse($data['to_date']);

        if ($from->diffInDays($to) > 90) {
            return response()->json(['message' => 'Maksimal 90 hari per recalculate.'], 422);
        }

        $employees = \App\Models\Employee::where('company_id', $data['company_id'])
            ->where('status', 'active')->pluck('id');

        if ($employees->isEmpty()) {
            return response()->json(['message' => 'Tidak ada karyawan aktif.'], 422);
        }

        $employeeCount = $employees->count();
        $calcService = app(\App\Services\Attendance\AttendanceCalculationService::class);
        $done = 0;
        $cursor = $from->copy();
        while ($cursor->lte($to)) {
            $dateStr = $cursor->format('Y-m-d');
            foreach ($employees as $empId) {
                try { $calcService->calculateForEmployeeDate($empId, $dateStr); } catch (\Throwable $e) {}
                $done++;
            }
            $cursor->addDay();
        }
        $days = $from->diffInDays($to) + 1;
        return response()->json([
            'message'   => "Hitung ulang selesai: {$employeeCount} karyawan × {$days} hari = {$done} proses.",
            'job_count' => $done,
        ]);
    }

    /**
     * Resolusi manual data gantung (incomplete).
     * HRD memasukkan jam pulang yang sebenarnya, lalu sistem inject log baru
     * dan recalculate summary otomatis.
     */
    public function resolveIncomplete(Request $request, string $summaryId)
    {
        $data = $request->validate([
            'time_type'         => 'required|in:check_in,check_out,both',
            'actual_start_time' => 'required_if:time_type,check_in,both|nullable|date_format:H:i',
            'actual_end_time'   => 'required_if:time_type,check_out,both|nullable|date_format:H:i',
            'notes'             => 'nullable|string|max:500',
        ]);

        $summary = AttendanceSummary::findOrFail($summaryId);
        $date    = $summary->attendance_date->format('Y-m-d');
        $notes   = $data['notes'] ?? 'Diisi manual oleh HRD';

        // Inject jam masuk jika dipilih
        if (in_array($data['time_type'], ['check_in', 'both']) && ! empty($data['actual_start_time'])) {
            \App\Models\AttendanceLog::firstOrCreate(
                ['employee_id' => $summary->employee_id, 'logged_time' => $date . ' ' . $data['actual_start_time'] . ':00', 'log_type' => 'manual_entry'],
                ['company_id' => $summary->company_id, 'notes' => $notes . ' (jam masuk)']
            );
        }

        // Inject jam keluar jika dipilih
        if (in_array($data['time_type'], ['check_out', 'both']) && ! empty($data['actual_end_time'])) {
            \App\Models\AttendanceLog::firstOrCreate(
                ['employee_id' => $summary->employee_id, 'logged_time' => $date . ' ' . $data['actual_end_time'] . ':00', 'log_type' => 'manual_entry'],
                ['company_id' => $summary->company_id, 'notes' => $notes . ' (jam keluar)']
            );
        }

        $summary->update(['status' => 'manually_reviewed']);

        try {
            $calcService = app(\App\Services\Attendance\AttendanceCalculationService::class);
            $updated = $calcService->calculateForEmployeeDate($summary->employee_id, $date);
            return response()->json(['data' => $updated]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('resolveIncomplete recalc failed', ['employee_id' => $summary->employee_id, 'date' => $date, 'error' => $e->getMessage()]);
            return response()->json(['data' => $summary->fresh()]);
        }
    }

    /** Batch resolve semua data gantung dengan jam pulang yang sama */
    public function batchResolveIncomplete(Request $request)
    {
        $data = $request->validate([
            'company_id'        => 'required|uuid|exists:companies,id',
            'time_type'         => 'required|in:check_in,check_out,both',
            'actual_start_time' => 'required_if:time_type,check_in,both|nullable|date_format:H:i',
            'actual_end_time'   => 'required_if:time_type,check_out,both|nullable|date_format:H:i',
            'from_date'         => 'nullable|date',
            'summary_ids'       => 'nullable|array',
            'summary_ids.*'     => 'uuid',
            'to_date'           => 'nullable|date|after_or_equal:from_date',
            'department'        => 'nullable|string',
            'notes'             => 'nullable|string|max:500',
        ]);

        // Jika summary_ids spesifik dikirim → resolve hanya yang dipilih
        if (! empty($data['summary_ids'])) {
            $query = AttendanceSummary::where('company_id', $data['company_id'])
                ->whereIn('id', $data['summary_ids']);
        } else {
            $query = AttendanceSummary::where('company_id', $data['company_id'])
                ->where('attendance_status', 'incomplete');
            if (! empty($data['from_date'])) $query->whereDate('attendance_date', '>=', $data['from_date']);
            if (! empty($data['to_date']))   $query->whereDate('attendance_date', '<=', $data['to_date']);
            if (! empty($data['department'])) {
                $query->whereHas('employee', fn ($q) => $q->where('department', $data['department']));
            }
        }

        $summaries = $query->get();
        $resolved  = 0;
        $calcService = app(\App\Services\Attendance\AttendanceCalculationService::class);
        $notes = $data['notes'] ?? 'Diselesaikan manual (batch) oleh HRD';

        foreach ($summaries as $summary) {
            $date = $summary->attendance_date->format('Y-m-d');

            if (in_array($data['time_type'], ['check_in','both']) && ! empty($data['actual_start_time'])) {
                \App\Models\AttendanceLog::firstOrCreate(
                    ['employee_id' => $summary->employee_id, 'logged_time' => $date . ' ' . $data['actual_start_time'] . ':00', 'log_type' => 'manual_entry'],
                    ['company_id' => $summary->company_id, 'notes' => $notes . ' (jam masuk)']
                );
            }
            if (in_array($data['time_type'], ['check_out','both']) && ! empty($data['actual_end_time'])) {
                \App\Models\AttendanceLog::firstOrCreate(
                    ['employee_id' => $summary->employee_id, 'logged_time' => $date . ' ' . $data['actual_end_time'] . ':00', 'log_type' => 'manual_entry'],
                    ['company_id' => $summary->company_id, 'notes' => $notes . ' (jam keluar)']
                );
            }

            $summary->update(['status' => 'manually_reviewed']);
            try { $calcService->calculateForEmployeeDate($summary->employee_id, $date); } catch (\Throwable $e) {}
            $resolved++;
        }

        return response()->json([
            'message'  => "{$resolved} data gantung berhasil diselesaikan.",
            'resolved' => $resolved,
        ]);
    }

    /** Export laporan absensi ke Excel */
    public function exportAttendance(Request $request)
    {
        $data = $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'from_date'  => 'required|date',
            'to_date'    => 'required|date|after_or_equal:from_date',
            'department' => 'nullable|string',
            'status'     => 'nullable|string',
        ]);

        $query = AttendanceSummary::with('employee:id,name,nik,department,position')
            ->where('company_id', $data['company_id'])
            ->whereBetween('attendance_date', [$data['from_date'], $data['to_date']])
            ->orderBy('attendance_date')
            ->orderBy('employee_id');

        if (! empty($data['department'])) {
            $query->whereHas('employee', fn ($q) => $q->where('department', $data['department']));
        }
        if (! empty($data['status']) && $data['status'] !== 'all') {
            $query->where('attendance_status', $data['status']);
        }

        $rows = $query->get();
        $company = \App\Models\Company::find($data['company_id']);

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $ws = $spreadsheet->getActiveSheet();
        $ws->setTitle('Laporan Absensi');

        $c    = fn (int $n): string => \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($n);
        $thin = ['borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN]]];
        $hFill= ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1F3864']];

        // Header
        $ws->setCellValue('A1', $company?->name . ' — Laporan Absensi');
        $ws->mergeCells('A1:M1');
        $ws->getStyle('A1')->getFont()->setBold(true)->setSize(11);

        $ws->setCellValue('A2', "Periode: {$data['from_date']} s/d {$data['to_date']}" . (! empty($data['department']) ? " · Dept: {$data['department']}" : ''));
        $ws->mergeCells('A2:M2');

        $headers = ['No','Tanggal','NIK','Nama','Departemen','Jabatan','Status','Jam Masuk','Jam Pulang','Mnt Kerja','Mnt OT','Terlambat','Ket'];
        foreach ($headers as $i => $h) {
            $coord = $c($i + 1) . '3';
            $ws->setCellValue($coord, $h);
            $ws->getStyle($coord)->applyFromArray([
                'font'      => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 9],
                'fill'      => $hFill,
                'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
                'borders'   => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN]],
            ]);
        }

        $statusLabel = [
            'present'           => 'Hadir',
            'absent'            => 'Absen',
            'incomplete'        => 'Gantung',
            'manually_reviewed' => 'Manual',
            'day_off'           => 'Libur',
            'holiday'           => 'Libur',
        ];

        $no = 1; $row = 4;
        foreach ($rows as $r) {
            $vals = [
                $no++,
                $r->attendance_date?->format('d/m/Y'),
                $r->employee?->nik ?? '-',
                $r->employee?->name ?? '-',
                $r->employee?->department ?? '-',
                $r->employee?->position ?? '-',
                $statusLabel[$r->attendance_status] ?? $r->attendance_status,
                $r->actual_start_time ? substr($r->actual_start_time, 0, 5) : '-',
                $r->actual_end_time   ? substr($r->actual_end_time,   0, 5) : '-',
                $r->productive_work_minutes ?? 0,
                $r->overtime_minutes ?? 0,
                $r->late_minutes ?? 0,
                $r->notes ?? '',
            ];
            foreach ($vals as $i => $v) {
                $ws->setCellValue($c($i + 1) . $row, $v);
            }
            $ws->getStyle("A{$row}:M{$row}")->applyFromArray($thin);
            $row++;
        }

        // Auto width
        foreach (range(1, 13) as $ci) $ws->getColumnDimension($c($ci))->setAutoSize(true);
        $ws->freezePane('A4');

        $filename = "Absensi_{$data['from_date']}_{$data['to_date']}_{$company?->code}.xlsx";
        $tmpFile  = tempnam(sys_get_temp_dir(), 'absensi');
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet))->save($tmpFile);
        $contents = file_get_contents($tmpFile);
        @unlink($tmpFile);

        return response($contents, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Content-Length'      => strlen($contents),
        ]);
    }
}
