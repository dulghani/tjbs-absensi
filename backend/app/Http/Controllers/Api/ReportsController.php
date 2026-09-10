<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceSummary;
use App\Models\Employee;
use App\Models\OvertimeRequest;
use App\Models\Payroll;
use App\Models\PayrollDetail;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    /**
     * Rekap kehadiran per karyawan dalam satu periode.
     * Agregat attendance_summaries: hari hadir, absen, terlambat, lembur, undertime.
     */
    public function attendanceSummary(Request $request)
    {
        $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'from_date' => 'required|date',
            'to_date' => 'required|date|after_or_equal:from_date',
            'department' => 'nullable|string',
        ]);

        $query = Employee::with('company:id,name')
            ->where('company_id', $request->company_id)
            ->where('status', 'active');

        if ($request->department && $request->department !== 'all') {
            $query->where('department', $request->department);
        }

        $employees = $query->orderBy('name')->get();

        $rows = $employees->map(function (Employee $emp) use ($request) {
            $summaries = AttendanceSummary::where('employee_id', $emp->id)
                ->whereBetween('attendance_date', [$request->from_date, $request->to_date])
                ->get();

            $hadir   = $summaries->whereIn('attendance_status', ['present', 'late', 'early_leave'])->count();
            $absen   = $summaries->where('attendance_status', 'absen')->count() +
                       $summaries->where('attendance_status', 'absent')->count();
            $telat   = $summaries->where('attendance_status', 'late')->count();
            $cepat   = $summaries->where('attendance_status', 'early_leave')->count();
            $cuti    = $summaries->where('attendance_status', 'on_leave')->count();
            $gantung = $summaries->where('attendance_status', 'incomplete')->count();

            $totalOvertimeMin  = $summaries->sum('overtime_minutes');
            $totalUndertimeMin = $summaries->sum('undertime_minutes');
            $totalWorkMin      = $summaries->sum('productive_work_minutes');

            return [
                'employee_id'        => $emp->id,
                'nik'                => $emp->nik,
                'name'               => $emp->name,
                'department'         => $emp->department,
                'position'           => $emp->position,
                'hari_hadir'         => $hadir,
                'hari_absen'         => $absen,
                'hari_telat'         => $telat,
                'hari_pulang_cepat'  => $cepat,
                'hari_cuti'          => $cuti,
                'data_gantung'       => $gantung,
                'total_lembur_menit' => $totalOvertimeMin,
                'total_kurang_menit' => $totalUndertimeMin,
                'total_kerja_menit'  => $totalWorkMin,
                'total_kerja_jam'    => round($totalWorkMin / 60, 1),
                'total_lembur_jam'   => round($totalOvertimeMin / 60, 1),
            ];
        });

        return response()->json([
            'data' => $rows,
            'meta' => [
                'company_id' => $request->company_id,
                'from_date'  => $request->from_date,
                'to_date'    => $request->to_date,
                'total_employees' => $employees->count(),
                'generated_at' => now()->toDateTimeString(),
            ],
        ]);
    }

    /**
     * Detail absensi harian per karyawan (untuk tabel drilling-down dari rekap).
     */
    public function attendanceDetail(Request $request)
    {
        $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'employee_id' => 'required|uuid|exists:employees,id',
            'from_date' => 'required|date',
            'to_date' => 'required|date',
        ]);

        $rows = AttendanceSummary::where('employee_id', $request->employee_id)
            ->whereBetween('attendance_date', [$request->from_date, $request->to_date])
            ->orderBy('attendance_date')
            ->get();

        return response()->json(['data' => $rows]);
    }

    /**
     * Rekap lembur per karyawan untuk satu periode.
     */
    public function overtimeSummary(Request $request)
    {
        $request->validate([
            'company_id'   => 'required|uuid|exists:companies,id',
            'period_month' => 'required|integer|min:1|max:12',
            'period_year'  => 'required|integer|min:2020',
            'department'   => 'nullable|string',
        ]);

        $query = AttendanceSummary::with('employee:id,name,nik,department,position')
            ->where('company_id', $request->company_id)
            ->whereMonth('attendance_date', $request->period_month)
            ->whereYear('attendance_date', $request->period_year)
            ->where('overtime_minutes', '>', 0);

        if ($request->department && $request->department !== 'all') {
            $query->whereHas('employee', fn ($q) => $q->where('department', $request->department));
        }

        $records = $query->orderBy('attendance_date')->get();

        // Kelompokkan per karyawan
        $grouped = $records->groupBy('employee_id')->map(function ($rows) {
            $emp = $rows->first()->employee;
            $totalMin = $rows->sum('overtime_minutes');
            $verified = $rows->where('overtime_verified', true)->count();
            $unverified = $rows->where('overtime_verified', false)->count();

            return [
                'employee_id'    => $emp?->id,
                'nik'            => $emp?->nik,
                'name'           => $emp?->name,
                'department'     => $emp?->department,
                'position'       => $emp?->position,
                'hari_lembur'    => $rows->count(),
                'total_menit'    => $totalMin,
                'total_jam'      => round($totalMin / 60, 2),
                'terverifikasi'  => $verified,
                'warning'        => $unverified,
                'detail'         => $rows->map(fn ($r) => [
                    'date'             => $r->attendance_date->format('Y-m-d'),
                    'overtime_minutes' => $r->overtime_minutes,
                    'overtime_verified' => $r->overtime_verified,
                    'shift_type'       => $r->shift_type,
                ])->values(),
            ];
        })->values();

        return response()->json([
            'data' => $grouped,
            'meta' => [
                'period_month' => $request->period_month,
                'period_year'  => $request->period_year,
                'total_employees' => $grouped->count(),
                'total_overtime_jam' => round($records->sum('overtime_minutes') / 60, 2),
            ],
        ]);
    }

    /**
     * Daftar slip gaji untuk semua karyawan dalam satu payroll.
     */
    public function payrollSlips(string $payrollId)
    {
        $payroll = Payroll::with('company:id,name,address,code')->findOrFail($payrollId);

        $details = PayrollDetail::with('employee:id,name,nik,department,position')
            ->where('payroll_id', $payrollId)
            ->orderBy('created_at')
            ->get()
            ->map(fn ($d) => $this->normalizeSlip($d, $payroll));

        return response()->json([
            'payroll' => [
                'id'                => $payroll->id,
                'company'           => $payroll->company,
                'period_month'      => $payroll->period_month,
                'period_year'       => $payroll->period_year,
                'effective_work_days' => $payroll->effective_work_days,
                'status'            => $payroll->status,
                'total_gross'       => $payroll->total_gross,
                'total_net'         => $payroll->total_net,
                'employee_count'    => $payroll->employee_count,
                'finalized_at'      => $payroll->finalized_at,
            ],
            'slips' => $details,
        ]);
    }

    /**
     * Slip gaji satu karyawan dalam satu payroll.
     */
    public function payrollSlip(string $payrollId, string $employeeId)
    {
        $payroll = Payroll::with('company:id,name,address,code')->findOrFail($payrollId);
        $detail = PayrollDetail::with('employee:id,name,nik,department,position')
            ->where('payroll_id', $payrollId)
            ->where('employee_id', $employeeId)
            ->firstOrFail();

        return response()->json([
            'payroll' => [
                'company'      => $payroll->company,
                'period_month' => $payroll->period_month,
                'period_year'  => $payroll->period_year,
                'effective_work_days' => $payroll->effective_work_days,
                'status'       => $payroll->status,
            ],
            'slip' => $this->normalizeSlip($detail, $payroll),
        ]);
    }

    protected function normalizeSlip(PayrollDetail $detail, Payroll $payroll): array
    {
        $breakdown = $detail->component_breakdown ?? [];
        $earnings   = array_filter($breakdown, fn ($c) => ($c['type'] ?? '') === 'earning');
        $deductions = array_filter($breakdown, fn ($c) => ($c['type'] ?? '') === 'deduction');

        // Petakan komponen ke key standar untuk export Excel
        $byCalc = collect($breakdown)->keyBy('calc');
        $breakdownMap = [
            'daily_wage'             => (float) ($byCalc['daily_wage_rate']['value'] ?? 0),
            'attendance_earning'     => (float) ($byCalc['attendance_earning']['value'] ?? 0),
            'overtime_regular'       => (float) ($byCalc['overtime_regular']['value'] ?? 0),
            'overtime_regular_hours' => (int) ($byCalc['overtime_regular_hours']['value'] ?? $detail->total_overtime_hours ?? 0),
            'overtime_holiday'       => (float) ($byCalc['overtime_holiday']['value'] ?? 0),
            'overtime_holiday_hours' => (int) ($byCalc['overtime_holiday_hours']['value'] ?? 0),
            'absence_deduction'      => (float) ($byCalc['absence_deduction']['value'] ?? 0),
            'absent'                 => max(0, ($payroll->effective_work_days ?? 0) - ($detail->total_work_days ?? 0)),
            'bpjs_tk'                => (float) ($byCalc['bpjs_tk']['value'] ?? 0),
            'outsourcing_fee'        => (float) ($byCalc['outsourcing_fee']['value'] ?? 0),
            'ppn'                    => (float) ($byCalc['ppn']['value'] ?? 0),
            'pph23'                  => (float) ($byCalc['pph23']['value'] ?? 0),
            'premi_hadir'            => (float) ($byCalc['premi_hadir']['value'] ?? 0),
        ];

        return [
            'employee_id'         => $detail->employee_id,
            'nik'                 => $detail->employee?->nik,
            'name'                => $detail->employee?->name,
            'employee_name'       => $detail->employee?->name,
            'department'          => $detail->employee?->department,
            'position'            => $detail->employee?->position,
            'join_date'           => $detail->employee?->join_date?->format('d/m/Y'),
            'total_work_days'     => $detail->total_work_days,
            'total_work_hours'    => $detail->total_work_hours,
            'total_overtime_hours'=> $detail->total_overtime_hours,
            'breakdown'           => $breakdownMap,
            'earnings'            => array_values($earnings),
            'deductions'          => array_values($deductions),
            'gross_salary'        => $detail->gross_salary,
            'total_deduction'     => $detail->total_deduction,
            'net_salary'          => $detail->net_salary,
            'effective_work_days' => $payroll->effective_work_days,
        ];
    }

    /** Export sheet Gaji ke Excel (.xlsx) menggunakan PhpSpreadsheet v2.x */
    public function exportGaji(string $payrollId)
    {
        try {
            $payroll = Payroll::with('company:id,name,code')->findOrFail($payrollId);

            $details = PayrollDetail::with('employee:id,name,nik,department,position,join_date')
                ->where('payroll_id', $payrollId)
                ->orderBy('created_at')
                ->get()
                ->map(fn ($d) => $this->normalizeSlip($d, $payroll));

            $months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
            $periodLabel = ($months[$payroll->period_month - 1] ?? $payroll->period_month) . ' ' . $payroll->period_year;

            $spreadsheet = new Spreadsheet();
            $ws = $spreadsheet->getActiveSheet();
            $ws->setTitle('Gaji');

            $c = fn(int $n): string => \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($n);
            $idr = '#,##0';
            $borderThin   = ['borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]]];
            $mkBlue   = 'FF1F3864'; // dark blue
            $mkLBlue  = 'FFBDD7EE'; // light blue
            $mkGreen  = 'FFE2EFDA'; // light green
            $mkRed    = 'FFFFC7CE'; // light red/pink
            $mkDBlue  = 'FFD9E1F2'; // dept blue

            $hStyle = fn(string $bg, string $fg = 'FF000000') => [
                'font'      => ['bold' => true, 'color' => ['argb' => $fg], 'size' => 9, 'name' => 'Arial'],
                'alignment' => ['horizontal' => 'center', 'vertical' => 'center', 'wrapText' => true],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $bg]],
                'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
            ];

            // ── Lebar kolom (29 kolom — hapus kolom Periode) ────────────────────
            // 1=NO,2=NIK,3=Dept,4=NAMA,5=DEPT,6=TglMasuk,7=MasaKerja,
            // 8=H,9=M,10=I,11=X,12=O,13=S,14=PA/TD,15=Absent,
            // 16=Upah/Hari,17=Upah, 18=LbBiasaJ,19=LbBiasaRp,20=LbMerahJ,21=LbMerahRp,
            // 22=Potongan,23=TOTAL,24=BPJS,25=Fee,26=PPn,27=PPh,28=Premi,29=Grand
            $widths = [5,8,7,28,13,13,18, 5,4,4,4,4,4,5,6, 12,13, 8,13,8,13, 12,13, 10,12,9,9,10, 14];
            foreach ($widths as $i => $w) {
                $ws->getColumnDimension($c($i + 1))->setWidth($w);
            }

            // ── Row 1-3: Judul ────────────────────────────────────────────────────
            $dateFrom = $payroll->date_from?->format('d/m/Y') ?? '';
            $dateTo   = $payroll->date_to?->format('d/m/Y') ?? '';

            $ws->setCellValue('A1', $payroll->company?->name);
            $ws->mergeCells('A1:AC1');
            $ws->getStyle('A1')->getFont()->setBold(true)->setSize(12)->setName('Arial');

            $ws->setCellValue('A2', "Periode: {$periodLabel}   |   Range Absensi: {$dateFrom} s/d {$dateTo}   |   Hari Kerja Efektif: {$payroll->effective_work_days} hari");
            $ws->mergeCells('A2:AC2');
            $ws->getStyle('A2')->getFont()->setSize(10)->setName('Arial');

            $ws->setCellValue('A3', "Scope: " . ($payroll->scope_label ?: 'Semua Karyawan'));
            $ws->mergeCells('A3:AC3');
            $ws->getStyle('A3')->getFont()->setItalic(true)->setSize(9);

            // ── Rows 4-6: Header 3 tingkat ───────────────────────────────────────
            $ws->getRowDimension(4)->setRowHeight(20);
            $ws->getRowDimension(5)->setRowHeight(16);
            $ws->getRowDimension(6)->setRowHeight(16);

            // Kolom dengan header tunggal (merge rows 4-6)
            $singleHeaders = [
                1  => "NO.", 2 => "NIK", 3 => "Dept.", 4 => "NAMA", 5 => "DEPT.",
                6  => "Tgl\nMasuk", 7 => "Masa\nKerja",
                8  => "H", 9 => "M", 10 => "I", 11 => "X", 12 => "O", 13 => "S",
                14 => "PA/\nTD", 15 => "Absent",
                16 => "Upah\n/Hari", 17 => "Upah\nHadir",
                22 => "Potongan", 23 => "TOTAL\nUPAH",
                24 => "BPJS TK", 25 => "Out-\nsorcing\nFEE",
                26 => "PPn", 27 => "PPh\n23", 28 => "Premi\nHadir", 29 => "Grand\nTotal",
            ];
            foreach ($singleHeaders as $ci => $label) {
                $col = $c($ci);
                $ws->mergeCells("{$col}4:{$col}6");
                $ws->setCellValue("{$col}4", $label);
                $bg = ($ci <= 7) ? $mkBlue : (($ci <= 17) ? $mkLBlue : $mkBlue);
                $fg = ($ci <= 7 || $ci >= 22) ? 'FFFFFFFF' : 'FF000000';
                $ws->getStyle("{$col}4:{$col}6")->applyFromArray($hStyle($bg, $fg));
            }

            // UPAH LEMBUR parent — row 4, cols 18-21
            $ws->mergeCells('R4:U4');
            $ws->setCellValue('R4', 'UPAH LEMBUR');
            $ws->getStyle('R4:U4')->applyFromArray($hStyle($mkBlue, 'FFFFFFFF'));

            // BIASA — row 5, cols 18-19
            $ws->mergeCells('R5:S5');
            $ws->setCellValue('R5', 'BIASA');
            $ws->getStyle('R5:S5')->applyFromArray($hStyle($mkLBlue));

            // MERAH — row 5, cols 20-21
            $ws->mergeCells('T5:U5');
            $ws->setCellValue('T5', 'MERAH');
            $ws->getStyle('T5:U5')->applyFromArray($hStyle($mkRed));

            // Sub-header row 6: JAM | Rp | JAM | Rp
            foreach (['R6' => 'JAM', 'S6' => 'Rp', 'T6' => 'JAM', 'U6' => 'Rp'] as $coord => $lbl) {
                $ws->setCellValue($coord, $lbl);
                $ws->getStyle($coord)->applyFromArray($hStyle($mkGreen));
            }

            // ── Data rows (mulai dari row 7) ──────────────────────────────────────
            $row = 7;
            $no  = 1;
            $gt  = array_fill_keys(['upah','lbj','lbrp','lmj','lmrp','pot','tu','bpjs','fee','ppn','pph','premi','grand'], 0.0);
            $groups = $details->groupBy('department');

            // Helper masa kerja
            $masaKerja = function(?string $joinDate, string $refDate): string {
                if (! $joinDate) return '-';
                $from = \Carbon\Carbon::parse($joinDate);
                $to   = \Carbon\Carbon::parse($refDate);
                if ($from->gt($to)) return '-';
                $diff = $from->diff($to);
                $parts = [];
                if ($diff->y) $parts[] = "{$diff->y} Th";
                if ($diff->m) $parts[] = "{$diff->m} Bl";
                if ($diff->d && !$diff->y) $parts[] = "{$diff->d} Hr";
                return implode(' ', $parts) ?: '< 1 Bl';
            };

            $refDate = $payroll->generated_at?->format('Y-m-d') ?? now()->format('Y-m-d');

            foreach ($groups as $dept => $members) {
                // Dept header
                $ws->setCellValue("A{$row}", strtoupper($dept ?: 'Lainnya'));
                $ws->mergeCells("A{$row}:AC{$row}");
                $ws->getStyle("A{$row}")->applyFromArray([
                    'font' => ['bold' => true, 'size' => 9],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => $mkDBlue]],
                ]);
                $row++;

                $st = array_fill_keys(array_keys($gt), 0.0);

                foreach ($members as $slip) {
                    $b = $slip['breakdown'];
                    // Join date dari slip
                    $joinRaw = $slip['join_date'] ?? null;
                    // Konversi d/m/Y → Y-m-d untuk Carbon
                    if ($joinRaw && str_contains($joinRaw, '/')) {
                        [$d, $m, $y] = explode('/', $joinRaw);
                        $joinRaw = "{$y}-{$m}-{$d}";
                    }

                    $values = [
                        1  => $no,
                        2  => $slip['nik'] ?? '',
                        3  => '',
                        4  => $slip['employee_name'] ?? '',
                        5  => $dept,
                        6  => $slip['join_date'] ?? '',
                        7  => $masaKerja($joinRaw, $refDate),
                        8  => (float)($slip['total_work_days'] ?? 0),
                        9  => 0, 10 => 0, 11 => 0, 12 => 0, 13 => 0, // M,I,X,O,S
                        14 => 0, // PA/TD
                        15 => (float)($b['absent'] ?? 0),
                        16 => (float)($b['daily_wage'] ?? 0),
                        17 => (float)($b['attendance_earning'] ?? $slip['gross_salary'] ?? 0),
                        18 => (float)($b['overtime_regular_hours'] ?? 0),
                        19 => (float)($b['overtime_regular'] ?? 0),
                        20 => (float)($b['overtime_holiday_hours'] ?? 0),
                        21 => (float)($b['overtime_holiday'] ?? 0),
                        22 => -(float)abs($b['absence_deduction'] ?? 0),
                        23 => (float)($slip['gross_salary'] ?? 0),
                        24 => (float)($b['bpjs_tk'] ?? 0),
                        25 => (float)($b['outsourcing_fee'] ?? 0),
                        26 => (float)($b['ppn'] ?? 0),
                        27 => (float)($b['pph23'] ?? 0),
                        28 => (float)($b['premi_hadir'] ?? 0),
                        29 => (float)($slip['net_salary'] ?? 0),
                    ];

                    foreach ($values as $ci => $val) {
                        $ws->setCellValue($c($ci) . $row, $val);
                    }
                    foreach ([16,17,19,21,22,23,24,25,26,27,28,29] as $ci) {
                        $ws->getStyle($c($ci) . $row)->getNumberFormat()->setFormatCode($idr);
                    }
                    $ws->getStyle("A{$row}:AC{$row}")->applyFromArray($borderThin);

                    $st['upah']  += (float)($b['attendance_earning'] ?? $slip['gross_salary'] ?? 0);
                    $st['lbj']   += (float)($b['overtime_regular_hours'] ?? 0);
                    $st['lbrp']  += (float)($b['overtime_regular'] ?? 0);
                    $st['lmj']   += (float)($b['overtime_holiday_hours'] ?? 0);
                    $st['lmrp']  += (float)($b['overtime_holiday'] ?? 0);                    $st['pot']   += (float)($b['absence_deduction'] ?? 0);
                    $st['tu']    += (float)($slip['gross_salary'] ?? 0);
                    $st['bpjs']  += (float)($b['bpjs_tk'] ?? 0);
                    $st['fee']   += (float)($b['outsourcing_fee'] ?? 0);
                    $st['ppn']   += (float)($b['ppn'] ?? 0);
                    $st['pph']   += (float)($b['pph23'] ?? 0);
                    $st['premi'] += (float)($b['premi_hadir'] ?? 0);
                    $st['grand'] += (float)($slip['net_salary'] ?? 0);
                    $no++; $row++;
                }

                // Subtotal dept
                $subValues = [4 => "Subtotal {$dept}", 17 => $st['upah'], 18 => $st['lbj'], 19 => $st['lbrp'],
                    20 => $st['lmj'], 21 => $st['lmrp'], 22 => -$st['pot'], 23 => $st['tu'],
                    24 => $st['bpjs'], 25 => $st['fee'], 26 => $st['ppn'], 27 => $st['pph'],
                    28 => $st['premi'], 29 => $st['grand']];
                foreach ($subValues as $ci => $val) { $ws->setCellValue($c($ci) . $row, $val); }
                foreach ([17,19,21,22,23,24,25,26,27,28,29] as $ci) {
                    $ws->getStyle($c($ci) . $row)->getNumberFormat()->setFormatCode($idr);
                }
                $ws->getStyle("A{$row}:AC{$row}")->applyFromArray([
                    'font' => ['bold' => true, 'size' => 9],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFBDD7EE']],
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
                ]);
                foreach (array_keys($gt) as $k) $gt[$k] += $st[$k];
                $row++;
            }

            // ── Grand Total ────────────────────────────────────────────────────
            $gtValues = [4 => 'GRAND TOTAL', 17 => $gt['upah'], 18 => $gt['lbj'], 19 => $gt['lbrp'],
                20 => $gt['lmj'], 21 => $gt['lmrp'], 22 => -$gt['pot'], 23 => $gt['tu'],
                24 => $gt['bpjs'], 25 => $gt['fee'], 26 => $gt['ppn'], 27 => $gt['pph'],
                28 => $gt['premi'], 29 => $gt['grand']];
            foreach ($gtValues as $ci => $val) { $ws->setCellValue($c($ci) . $row, $val); }
            foreach ([17,19,21,22,23,24,25,26,27,28,29] as $ci) {
                $ws->getStyle($c($ci) . $row)->getNumberFormat()->setFormatCode($idr);
            }
            $ws->getStyle("A{$row}:AC{$row}")->applyFromArray([
                'font'    => ['bold' => true, 'size' => 9, 'color' => ['argb' => 'FFFFFFFF']],
                'fill'    => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1F3864']],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_MEDIUM]],
            ]);

            $ws->freezePane('A7');
            $filename = "Gaji_{$periodLabel}_{$payroll->company?->code}.xlsx";

            // Simpan ke system temp file (bukan php://output) — lebih reliable untuk binary ZIP
            $tempFile = tempnam(sys_get_temp_dir(), 'phpxls');
            (new Xlsx($spreadsheet))->save($tempFile);

            if (! file_exists($tempFile) || filesize($tempFile) < 100) {
                throw new \RuntimeException('File Excel gagal dibuat atau kosong (' . filesize($tempFile) . ' bytes)');
            }

            $contents = file_get_contents($tempFile);
            @unlink($tempFile);

            return response($contents, 200, [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length'      => strlen($contents),
                'Cache-Control'       => 'no-cache, must-revalidate',
                'Pragma'              => 'public',
            ]);

        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('exportGaji failed', [
                'payroll_id' => $payrollId,
                'error'      => $e->getMessage(),
                'line'       => $e->getFile() . ':' . $e->getLine(),
            ]);
            return response()->json(['message' => 'Export gagal: ' . $e->getMessage()], 500);
        }
    }

    /** Rekap Harian: matrix per karyawan × per tanggal (seperti format rekapitulasi absensi bulanan) */
    public function rekapHarian(Request $request)
    {
        $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'from_date'  => 'required|date',
            'to_date'    => 'required|date|after_or_equal:from_date',
            'department' => 'nullable|string',
        ]);

        $company = \App\Models\Company::find($request->company_id);

        // Buat daftar tanggal dalam range
        $dates = [];
        $cursor = \Carbon\Carbon::parse($request->from_date);
        $end    = \Carbon\Carbon::parse($request->to_date);
        while ($cursor->lte($end)) {
            $dates[] = $cursor->format('Y-m-d');
            $cursor->addDay();
        }

        // Ambil karyawan aktif
        $empQuery = \App\Models\Employee::where('company_id', $request->company_id)
            ->where('status', 'active')->orderBy('name');
        if ($request->department && $request->department !== 'all') {
            $empQuery->where('department', $request->department);
        }
        $employees = $empQuery->get();

        // Ambil semua attendance_summaries dalam range sekaligus (1 query)
        $allSummaries = \App\Models\AttendanceSummary::where('company_id', $request->company_id)
            ->whereBetween('attendance_date', [$request->from_date, $request->to_date])
            ->whereIn('employee_id', $employees->pluck('id'))
            ->get()
            ->groupBy(fn ($s) => $s->employee_id . '|' . $s->attendance_date->format('Y-m-d'));

        $rows = $employees->map(function ($emp) use ($dates, $allSummaries) {
            $dailyStatus = [];
            $totalHadir  = 0; $totalAbsen = 0; $totalSakit = 0;
            $totalIjin   = 0; $totalGantung = 0; $totalLembur = 0;
            $totalKerjaMenit = 0; $totalLemburMenit = 0;

            foreach ($dates as $date) {
                $summary = $allSummaries->get($emp->id . '|' . $date)?->first();

                $status = null;
                if ($summary) {
                    $status = match ($summary->attendance_status) {
                        'present', 'late', 'early_leave' => 'H',
                        'absent'                          => 'A',
                        'on_leave'                        => 'I',
                        'sick'                            => 'S',
                        'incomplete'                      => '?',
                        'day_off', 'holiday'              => '-',
                        default                           => 'H',
                    };
                    if (in_array($status, ['H'])) {
                        $totalHadir++;
                        $totalKerjaMenit  += $summary->productive_work_minutes ?? 0;
                        $totalLemburMenit += $summary->overtime_minutes ?? 0;
                        if (($summary->overtime_minutes ?? 0) > 0) $totalLembur++;
                    } elseif ($status === 'A') $totalAbsen++;
                    elseif ($status === 'S') $totalSakit++;
                    elseif ($status === 'I') $totalIjin++;
                    elseif ($status === '?') $totalGantung++;
                }
                $dailyStatus[$date] = $status;
            }

            // Format durasi: jam:menit
            $fDur = fn (int $mnt): string => floor($mnt / 60) . ':' . str_pad($mnt % 60, 2, '0', STR_PAD_LEFT);

            return [
                'employee_id' => $emp->id,
                'nik'         => $emp->nik,
                'name'        => $emp->name,
                'department'  => $emp->department,
                'position'    => $emp->position,
                'daily'       => $dailyStatus,
                'hadir'       => $totalHadir,
                'durasi_kerja' => $fDur($totalKerjaMenit),
                'absen'       => $totalAbsen,
                'sakit'       => $totalSakit,
                'ijin'        => $totalIjin,
                'gantung'     => $totalGantung,
                'lembur_hari' => $totalLembur,
                'durasi_lembur' => $fDur($totalLemburMenit),
            ];
        });

        return response()->json([
            'data'    => $rows,
            'dates'   => $dates,
            'company' => $company?->name,
            'meta'    => [
                'from_date'        => $request->from_date,
                'to_date'          => $request->to_date,
                'total_employees'  => $employees->count(),
            ],
        ]);
    }

    /** Export Rekap Harian ke Excel */
    public function exportRekapHarian(Request $request)
    {
        $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'from_date'  => 'required|date',
            'to_date'    => 'required|date|after_or_equal:from_date',
            'department' => 'nullable|string',
        ]);

        $json    = $this->rekapHarian($request)->getData(true);
        $rows    = $json['data'];
        $dates   = $json['dates'];
        $company = $json['company'];

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $ws = $spreadsheet->getActiveSheet();
        $ws->setTitle('Rekap Harian');
        $c    = fn (int $n): string => \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($n);
        $thin = ['borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN]]];
        $hdrStyle = ['font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 9],
            'fill' => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1F3864']],
            'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
            'borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN]]];

        $lastCol = $c(4 + count($dates) + 9);
        $ws->setCellValue('A1', $company . ' — Rekap Harian Absensi');
        $ws->mergeCells("A1:{$lastCol}1");
        $ws->getStyle('A1')->getFont()->setBold(true)->setSize(11);
        $ws->setCellValue('A2', "Periode: {$request->from_date} s/d {$request->to_date}");
        $ws->mergeCells("A2:{$lastCol}2");

        $sd = 5; $ed = $sd + count($dates) - 1; $kc = $ed + 1;
        foreach (['A3:A4'=>'No','B3:B4'=>'Nama','C3:C4'=>'Dept','D3:D4'=>'NIK'] as $merge => $lbl) {
            [$r1,$r2] = explode(':', $merge); $ws->setCellValue($r1, $lbl); $ws->mergeCells($merge);
        }
        $ws->setCellValue($c($sd).'3', 'PERIODE ABSEN'); $ws->mergeCells($c($sd).'3:'.$c($ed).'3');
        $ws->setCellValue($c($kc).'3', 'KEHADIRAN');     $ws->mergeCells($c($kc).'3:'.$c($kc+1).'3');
        $ws->setCellValue($c($kc+2).'3', 'KETIDAKHADIRAN'); $ws->mergeCells($c($kc+2).'3:'.$c($kc+6).'3');
        $ws->setCellValue($c($kc+7).'3', 'LEMBUR');      $ws->mergeCells($c($kc+7).'3:'.$c($kc+8).'3');

        foreach ($dates as $i => $d) $ws->setCellValue($c($sd+$i).'4', (int)substr($d,8,2));
        foreach ([[$kc,'Total'],[$kc+1,'Durasi'],[$kc+2,'A'],[$kc+3,'S'],[$kc+4,'I'],[$kc+5,'⚠'],[$kc+6,'Total'],[$kc+7,'Hari'],[$kc+8,'Durasi']] as [$ci,$lbl])
            $ws->setCellValue($c($ci).'4', $lbl);

        $ws->getStyle('A3:'.$c($kc+8).'4')->applyFromArray($hdrStyle);

        $row = 5;
        foreach ($rows as $i => $r) {
            $ws->setCellValue('A'.$row, $i+1); $ws->setCellValue('B'.$row, $r['name']);
            $ws->setCellValue('C'.$row, $r['department']); $ws->setCellValue('D'.$row, $r['nik']);
            foreach ($dates as $j => $d) {
                $sym = $r['daily'][$d] ?? '';
                $ws->setCellValue($c($sd+$j).$row, $sym);
                if ($sym==='A') $ws->getStyle($c($sd+$j).$row)->getFont()->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FFCC0000'));
                if ($sym==='H') $ws->getStyle($c($sd+$j).$row)->getFont()->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF006600'));
            }
            $ws->setCellValue($c($kc).$row,$r['hadir']); $ws->setCellValue($c($kc+1).$row,$r['durasi_kerja']);
            $ws->setCellValue($c($kc+2).$row,$r['absen']?:''); $ws->setCellValue($c($kc+3).$row,$r['sakit']?:'');
            $ws->setCellValue($c($kc+4).$row,$r['ijin']?:''); $ws->setCellValue($c($kc+5).$row,$r['gantung']?:'');
            $ws->setCellValue($c($kc+6).$row,($r['absen']+$r['sakit']+$r['ijin']+$r['gantung'])?:'');
            $ws->setCellValue($c($kc+7).$row,$r['lembur_hari']?:'');
            $ws->setCellValue($c($kc+8).$row,$r['durasi_lembur']!=='0:00'?$r['durasi_lembur']:'');
            $ws->getStyle('A'.$row.':'.$c($kc+8).$row)->applyFromArray($thin);
            $row++;
        }

        foreach ([1,2,3,4] as $ci) $ws->getColumnDimension($c($ci))->setAutoSize(true);
        foreach (range($sd,$ed) as $ci) $ws->getColumnDimension($c($ci))->setWidth(4);
        foreach (range($kc,$kc+8) as $ci) $ws->getColumnDimension($c($ci))->setAutoSize(true);
        $ws->freezePane('E5');

        $filename = "RekapHarian_{$request->from_date}_{$request->to_date}.xlsx";
        $tmp = tempnam(sys_get_temp_dir(),'rekap');
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet))->save($tmp);
        $contents = file_get_contents($tmp); @unlink($tmp);

        return response($contents, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Content-Length'      => strlen($contents),
        ]);
    }
}
