<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceSummary;
use App\Models\Company;
use App\Models\Employee;
use App\Models\OvertimeRequest;
use App\Models\Payroll;
use App\Models\WorkDayException;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function stats(Request $request)
    {
        $user = $request->user();
        $isMulti = in_array($user->roles[0] ?? '', ['coordinator', 'field_officer', 'super_admin'], true);
        $companyId = $isMulti ? null : $user->company_id;

        $today = now('Asia/Jakarta');
        $todayStr   = $today->format('Y-m-d');
        $monthStart = $today->copy()->startOfMonth()->format('Y-m-d');

        $empQ = Employee::where('status', 'active');
        if ($companyId) $empQ->where('company_id', $companyId);

        $otQ = OvertimeRequest::query();
        if ($companyId) $otQ->where('company_id', $companyId);

        $attToday = AttendanceSummary::whereDate('attendance_date', $todayStr)
            ->when($companyId, fn($q) => $q->where('company_id', $companyId))
            ->selectRaw("
                COUNT(CASE WHEN attendance_status IN ('present','late','early_leave') THEN 1 END) as hadir,
                COUNT(CASE WHEN attendance_status = 'absent' THEN 1 END) as absen,
                COUNT(CASE WHEN attendance_status = 'incomplete' THEN 1 END) as gantung
            ")->first();

        $attMonth = AttendanceSummary::whereBetween('attendance_date', [$monthStart, $todayStr])
            ->when($companyId, fn($q) => $q->where('company_id', $companyId))
            ->selectRaw("
                COUNT(CASE WHEN attendance_status IN ('present','late','early_leave') THEN 1 END) as hadir,
                COUNT(CASE WHEN attendance_status = 'absent' THEN 1 END) as absen,
                COUNT(CASE WHEN attendance_status = 'incomplete' THEN 1 END) as gantung,
                SUM(overtime_minutes) as total_ot_minutes
            ")->first();

        $payQ = Payroll::query();
        if ($companyId) $payQ->where('company_id', $companyId);

        $chart7 = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = $today->copy()->subDays($i)->format('Y-m-d');
            $row = AttendanceSummary::whereDate('attendance_date', $d)
                ->when($companyId, fn($q) => $q->where('company_id', $companyId))
                ->selectRaw("
                    COUNT(CASE WHEN attendance_status IN ('present','late','early_leave') THEN 1 END) as hadir,
                    COUNT(CASE WHEN attendance_status = 'absent' THEN 1 END) as absen
                ")->first();
            $chart7[] = [
                'date'  => $d,
                'label' => \Carbon\Carbon::parse($d)->locale('id')->isoFormat('ddd D/M'),
                'hadir' => (int)($row->hadir ?? 0),
                'absen' => (int)($row->absen ?? 0),
            ];
        }

        return response()->json(['data' => [
            'totalCompanies'    => Company::count(),
            'totalEmployees'    => $empQ->count(),
            'today'             => ['hadir' => (int)($attToday->hadir ?? 0), 'absen' => (int)($attToday->absen ?? 0), 'gantung' => (int)($attToday->gantung ?? 0)],
            'thisMonth'         => ['hadir' => (int)($attMonth->hadir ?? 0), 'absen' => (int)($attMonth->absen ?? 0), 'gantung' => (int)($attMonth->gantung ?? 0), 'ot_hours' => round(($attMonth->total_ot_minutes ?? 0) / 60, 1)],
            'overtime'          => ['pending' => (clone $otQ)->where('status', 'pending')->count(), 'approved' => (clone $otQ)->where('status', 'approved')->whereMonth('overtime_date', $today->month)->count(), 'thisMonth' => (clone $otQ)->whereMonth('overtime_date', $today->month)->count()],
            'payroll'           => ['processing' => (clone $payQ)->where('status', 'processing')->count(), 'finalized' => (clone $payQ)->where('status', 'finalized')->where('period_year', $today->year)->where('period_month', $today->month)->count()],
            'chart7days'        => $chart7,
            'pendingOvertime'   => (clone $otQ)->where('status', 'pending')->count(),
            'payrollProcessing' => (clone $payQ)->where('status', 'processing')->count(),
            'payrollFinalized'  => (clone $payQ)->where('status', 'finalized')->count(),
            'payrollDraft'      => 0,
        ]]);
    }

    /** Daily monitoring: donut chart kehadiran hari ini per perusahaan */
    public function monitoring(Request $request)
    {
        $companyId = $request->company_id;
        $date = $request->date ?? now('Asia/Jakarta')->format('Y-m-d');

        $q = AttendanceSummary::whereDate('attendance_date', $date);
        if ($companyId) $q->where('company_id', $companyId);

        $data = $q->selectRaw("
            COUNT(*) as total,
            COUNT(CASE WHEN attendance_status IN ('present') AND (late_minutes = 0 OR late_minutes IS NULL) THEN 1 END) as tepat_waktu,
            COUNT(CASE WHEN attendance_status IN ('present','late','early_leave') AND late_minutes > 0 THEN 1 END) as terlambat,
            COUNT(CASE WHEN attendance_status = 'absent' THEN 1 END) as tidak_hadir,
            COUNT(CASE WHEN attendance_status = 'on_leave' THEN 1 END) as izin,
            COUNT(CASE WHEN attendance_status = 'incomplete' THEN 1 END) as gantung
        ")->first();

        $total = max(1, (int)$data->total);

        return response()->json(['data' => [
            'total'       => (int)$data->total,
            'tepat_waktu' => (int)$data->tepat_waktu,
            'terlambat'   => (int)$data->terlambat,
            'tidak_hadir' => (int)$data->tidak_hadir,
            'izin'        => (int)$data->izin,
            'gantung'     => (int)$data->gantung,
            'pct_tepat'   => round($data->tepat_waktu / $total * 100, 2),
            'pct_tidak'   => round($data->tidak_hadir / $total * 100, 2),
            'pct_lambat'  => round($data->terlambat   / $total * 100, 2),
            'pct_izin'    => round($data->izin         / $total * 100, 2),
        ]]);
    }

    /** Chart performa kehadiran per minggu dalam bulan */
    public function chartWeekly(Request $request)
    {
        $month = $request->month ?? now()->month;
        $year  = $request->year  ?? now()->year;

        $companies = Company::select('id', 'name', 'code')->get();

        $firstDay = \Carbon\Carbon::create($year, $month, 1);
        $lastDay  = $firstDay->copy()->endOfMonth();

        // Bagi bulan ke minggu-minggu
        $weeks = [];
        $cursor = $firstDay->copy()->startOfWeek(\Carbon\Carbon::MONDAY);
        $weekNo = 1;
        while ($cursor->lte($lastDay)) {
            $weekStart = $cursor->copy()->max($firstDay)->format('Y-m-d');
            $weekEnd   = $cursor->copy()->endOfWeek(\Carbon\Carbon::SUNDAY)->min($lastDay)->format('Y-m-d');
            $weeks[] = ['label' => "Minggu ke-{$weekNo}", 'start' => $weekStart, 'end' => $weekEnd];
            $cursor->addWeek();
            $weekNo++;
        }

        $series = [];
        foreach ($companies as $company) {
            $points = [];
            foreach ($weeks as $week) {
                $total  = AttendanceSummary::where('company_id', $company->id)->whereBetween('attendance_date', [$week['start'], $week['end']])->count();
                $hadir  = AttendanceSummary::where('company_id', $company->id)->whereBetween('attendance_date', [$week['start'], $week['end']])->whereIn('attendance_status', ['present','late','early_leave'])->count();
                $points[] = $total > 0 ? round($hadir / $total * 100, 1) : 0;
            }
            $series[] = ['name' => $company->name, 'code' => $company->code, 'data' => $points];
        }

        return response()->json(['data' => ['weeks' => array_column($weeks, 'label'), 'series' => $series]]);
    }

    /** Karyawan indisipliner (absen tanpa keterangan) */
    public function indisipliner(Request $request)
    {
        $companyId = $request->company_id;
        $fromDate  = $request->from_date ?? now()->format('Y-m-d');
        $toDate    = $request->to_date   ?? now()->format('Y-m-d');
        $page      = max(1, (int)($request->page ?? 1));
        $perPage   = 10;

        $q = AttendanceSummary::with('employee:id,name,department,position')
            ->where('attendance_status', 'absent')
            ->whereBetween('attendance_date', [$fromDate, $toDate]);
        if ($companyId) $q->where('company_id', $companyId);

        $paginated = $q->orderBy('attendance_date', 'desc')->paginate($perPage, ['*'], 'page', $page);

        return response()->json(['data' => $paginated->items(), 'meta' => [
            'total' => $paginated->total(), 'last_page' => $paginated->lastPage(), 'current_page' => $paginated->currentPage(),
        ]]);
    }

    /** Data karyawan yang belum lengkap (minim departemen/jabatan/dll) */
    public function belumLengkap(Request $request)
    {
        $companyId = $request->company_id;
        $page      = max(1, (int)($request->page ?? 1));
        $perPage   = 10;

        // Hitung score kelengkapan: name, nik, department, position, join_date, phone
        $requiredFields = ['name', 'nik', 'department', 'position', 'join_date'];
        $totalFields    = count($requiredFields);

        $q = Employee::where('status', 'active');
        if ($companyId) $q->where('company_id', $companyId);

        // Filter yang ada field kosong
        $q->where(function ($qq) {
            $qq->whereNull('department')->orWhere('department', '')
               ->orWhereNull('position')->orWhere('position', '')
               ->orWhereNull('nik')->orWhere('nik', '')
               ->orWhereNull('join_date');
        });

        $paginated = $q->orderBy('name')->paginate($perPage, ['*'], 'page', $page);

        $items = collect($paginated->items())->map(function ($emp) use ($requiredFields, $totalFields) {
            $filled = 0;
            foreach ($requiredFields as $field) {
                if (! empty($emp->$field)) $filled++;
            }
            return [
                'id'         => $emp->id,
                'name'       => $emp->name,
                'department' => $emp->department,
                'position'   => $emp->position,
                'pct'        => round($filled / $totalFields * 100),
                'missing'    => array_filter($requiredFields, fn($f) => empty($emp->$f)),
            ];
        });

        return response()->json(['data' => $items, 'meta' => [
            'total' => $paginated->total(), 'last_page' => $paginated->lastPage(), 'current_page' => $paginated->currentPage(),
        ]]);
    }

    /** Kalender libur dari work_day_exceptions */
    public function kalender(Request $request)
    {
        $month = $request->month ?? now()->month;
        $year  = $request->year  ?? now()->year;
        $companyId = $request->company_id;

        $q = WorkDayException::whereMonth('exception_date', $month)->whereYear('exception_date', $year);
        if ($companyId) $q->where('company_id', $companyId);

        $events = $q->get()->map(fn($e) => [
            'date' => $e->exception_date->format('Y-m-d'),
            'day'  => $e->exception_date->day,
            'type' => $e->exception_type,
            'name' => $e->name,
        ]);

        return response()->json(['data' => $events]);
    }
}
