<?php

namespace App\Services\Payroll;

use App\Models\AttendanceSummary;
use App\Models\CompanySalaryComponent;
use App\Models\Employee;
use App\Models\EmployeeSalaryComponent;
use App\Models\Payroll;
use App\Models\PayrollDetail;

/**
 * Hitung gross/net gaji SATU karyawan untuk SATU periode payroll berdasarkan model
 * "upah harian" (bukan gaji bulanan tetap) — umum dipakai untuk karyawan outsourcing/pabrik.
 *
 * Parameter dasar (component_type dari company_salary_components):
 *   daily_wage_rate        "Upah Per Hari"      — rate rupiah/hari, diset manual per perusahaan
 *                                                  (naik tiap tahun). Baris referensi, TIDAK
 *                                                  ikut dijumlah ke gross langsung.
 *   overtime_holiday       "Lembur Merah"       — rate rupiah/jam untuk lembur di hari libur,
 *                                                  diset manual per perusahaan.
 *
 * Parameter per-periode (dari Payroll::effective_work_days, diisi manual tiap proses payroll
 * karena jumlah hari kerja efektif beda tiap bulan):
 *   "Hari Kerja Efektif" — dipakai sebagai acuan hitung potongan absen.
 *
 * Earning otomatis (dihitung dari attendance_summaries, tidak perlu base_value):
 *   attendance_earning      "Kehadiran"      = upah_per_hari x hari_hadir_aktual
 *   overtime_regular        "Lembur Biasa"   = (upah_per_hari / 7) x jam_lembur_hari_efektif
 *   overtime_holiday        "Lembur Merah"   = rate_lembur_merah x jam_lembur_hari_libur
 *
 * Deduction otomatis:
 *   absence_deduction       "Potongan Absen"       = upah_per_hari x (hari_kerja_efektif - hari_hadir)
 *   early_leave_deduction   "Potongan Izin Pulang" = (upah_per_hari / 8 / 60) x total_menit_early_leave
 *
 * Tipe lama (fixed/percentage/per_hari/formula/manual) tetap didukung untuk komponen
 * tambahan seperti tunjangan/BPJS di luar formula upah harian di atas.
 */
class PayrollCalculationService
{
    public function calculateForPayroll(Payroll $payroll): void
    {
        $query = Employee::where('company_id', $payroll->company_id)->where('status', 'active');

        // Filter opsional per divisi / departemen
        if ($payroll->division_id)  $query->where('division_id', $payroll->division_id);
        if ($payroll->department)   $query->where('department', $payroll->department);

        $employees = $query->get();

        $totalGross = 0;
        $totalNet   = 0;

        foreach ($employees as $employee) {
            $detail      = $this->calculateForEmployee($employee, $payroll);
            $totalGross += $detail->gross_salary;
            $totalNet   += $detail->net_salary;
        }

        $payroll->update([
            'employee_count' => $employees->count(),
            'total_gross'    => $totalGross,
            'total_net'      => $totalNet,
        ]);
    }

    public function calculateForEmployee(Employee $employee, Payroll $payroll): PayrollDetail
    {
        // Gunakan date_from / date_to kalau ada, fallback ke bulan kalender
        $fromDate = $payroll->date_from ?? "{$payroll->period_year}-{$payroll->period_month}-01";
        $toDate   = $payroll->date_to
            ?? \Carbon\Carbon::create($payroll->period_year, $payroll->period_month, 1)->endOfMonth()->format('Y-m-d');

        $summaries = AttendanceSummary::where('employee_id', $employee->id)
            ->whereBetween('attendance_date', [$fromDate, $toDate])
            ->get();

        // Hadir = present + late + early_leave (on_leave/cuti TIDAK dihitung hadir — dipotong)
        $hariHadir = $summaries->whereIn('attendance_status', ['present', 'late', 'early_leave'])->count();
        // day_off & holiday: hari libur resmi — tidak dihitung absen
        $hariLibur = $summaries->whereIn('attendance_status', ['day_off', 'holiday'])->count();
        $hariHadirMurni = $hariHadir;
        $earlyLeaveMinutes = $summaries->sum('early_leave_minutes');

        // Hitung hari on_leave yang BERBAYAR (is_paid = true) → tidak dipotong gaji
        $paidLeaveDates = \App\Models\LeaveRequest::where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->where('leave_type', 'not_present')
            ->where('is_paid', true)
            ->whereBetween('leave_date', [$fromDate, $toDate])
            ->pluck('leave_date')
            ->map(fn($d) => \Carbon\Carbon::parse($d)->format('Y-m-d'))
            ->toArray();

        // on_leave berbayar → dianggap hadir (tidak dipotong)
        // on_leave tidak berbayar → dianggap absen (dipotong)
        $onLeaveSummaries = $summaries->where('attendance_status', 'on_leave');
        $hariOnLeaveBerbayar    = $onLeaveSummaries->filter(fn($s) => in_array($s->attendance_date->format('Y-m-d'), $paidLeaveDates))->count();
        $hariOnLeaveTidakBayar  = $onLeaveSummaries->count() - $hariOnLeaveBerbayar;

        // Hadir efektif: tambah on_leave berbayar (karena gaji tetap jalan)
        $hariHadir += $hariOnLeaveBerbayar;

        // Absen = tidak masuk tanpa keterangan + cuti tidak berbayar
        $hariAbsen = $summaries->where('attendance_status', 'absent')->count() + $hariOnLeaveTidakBayar;

        // ── Lembur: SPL approved DAN harus ada lembur aktual di absensi ─────────
        // Rumus: lembur_terbayar = MIN(jam_SPL_approved, jam_lembur_aktual_absensi) per hari
        // Jika karyawan tidak lembur (pulang tepat waktu), lembur = 0 meski ada SPL approved.
        $overtimeRegularMinutes = 0;
        $overtimeHolidayMinutes = 0;

        // Group attendance summaries per tanggal untuk lookup cepat
        $summaryByDate = $summaries->keyBy(fn($s) => $s->attendance_date->format('Y-m-d'));

        $approvedOvertimes = \App\Models\OvertimeRequestDetail::whereHas('overtimeRequest', function ($q) use ($employee, $fromDate, $toDate) {
                $q->where('company_id', $employee->company_id)
                  ->whereBetween('overtime_date', [$fromDate, $toDate])
                  ->where('status', 'approved');
            })
            ->where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->with('overtimeRequest:id,overtime_date')
            ->get();

        foreach ($approvedOvertimes as $ot) {
            $date    = $ot->overtimeRequest?->overtime_date?->format('Y-m-d');
            $summary = $date ? ($summaryByDate[$date] ?? null) : null;

            // Lembur aktual di absensi hari itu (menit)
            $actualOvertimeMinutes = $summary?->overtime_minutes ?? 0;

            // Jika tidak ada lembur aktual → tidak dibayar (karyawan tidak lembur)
            if ($actualOvertimeMinutes <= 0) continue;

            // Ambil minimum: SPL disetujui vs lembur aktual
            $spl_minutes    = $ot->plan_duration_minutes ?? 0;
            $countedMinutes = min($spl_minutes, $actualOvertimeMinutes);

            $isHoliday = $summary?->shift_type === 'holiday';
            if ($isHoliday) {
                $overtimeHolidayMinutes += $countedMinutes;
            } else {
                $overtimeRegularMinutes += $countedMinutes;
            }
        }

        // Rounddown ke jam penuh (1j 56m = 1j, 2j 30m = 2j)
        $overtimeRegularHours  = (int) floor($overtimeRegularMinutes / 60);
        $overtimeHolidayHours  = (int) floor($overtimeHolidayMinutes / 60);
        $overtimeRegularMinutes = $overtimeRegularHours * 60;
        $overtimeHolidayMinutes = $overtimeHolidayHours * 60;

        // Hari kerja efektif dari input manual saat proses payroll. Kalau tidak diisi
        // (mis. payroll lama sebelum fitur ini ada), fallback ke hari_hadir supaya
        // potongan absen otomatis 0 (tidak salah hukum karyawan karena data tidak lengkap).
        $hariKerjaEfektif = $payroll->effective_work_days ?? ($hariHadir + $hariAbsen);

        // Ambil potongan manual — cocokkan period_month/year ATAU dalam rentang date_from-date_to
        $manualDeductionTotal = \App\Models\ManualDeduction::where('employee_id', $employee->id)
            ->where('status', 'active')
            ->where(function ($q) use ($payroll) {
                // Cocok persis dengan bulan/tahun payroll
                $q->where(function ($q2) use ($payroll) {
                    $q2->where('period_month', (int) $payroll->period_month)
                       ->where('period_year',  (int) $payroll->period_year);
                });
                // ATAU: bulan dari date_from (untuk payroll lintas bulan)
                if ($payroll->date_from) {
                    $dfMonth = (int) date('n', strtotime($payroll->date_from));
                    $dfYear  = (int) date('Y', strtotime($payroll->date_from));
                    if ($dfMonth !== (int)$payroll->period_month || $dfYear !== (int)$payroll->period_year) {
                        $q->orWhere(function ($q2) use ($dfMonth, $dfYear) {
                            $q2->where('period_month', $dfMonth)->where('period_year', $dfYear);
                        });
                    }
                }
            })
            ->sum('amount');

        $components = CompanySalaryComponent::where('company_id', $employee->company_id)->orderBy('sort_order')->get();
        $overrides = EmployeeSalaryComponent::where('employee_id', $employee->id)
            ->whereIn('salary_component_id', $components->pluck('id'))
            ->get()->keyBy('salary_component_id');

        $dailyWageComponent = $components->firstWhere('calculation_type', 'daily_wage_rate');
        $dailyWageOverride = $dailyWageComponent ? $overrides->get($dailyWageComponent->id) : null;
        $dailyWage = (float) ($dailyWageOverride->custom_value ?? $dailyWageComponent?->base_value ?? 0);

        $ctx = [
            'daily_wage'               => $dailyWage,
            'hari_hadir'               => $hariHadirMurni,
            'hari_kerja_efektif'       => $hariKerjaEfektif,
            'hari_absen'               => $hariAbsen,
            'overtime_regular_minutes' => $overtimeRegularMinutes,
            'overtime_holiday_minutes' => $overtimeHolidayMinutes,
            'overtime_regular_hours'   => $overtimeRegularHours,
            'overtime_holiday_hours'   => $overtimeHolidayHours,
            'early_leave_minutes'      => $earlyLeaveMinutes,
            'manual_deduction_total'   => (float) $manualDeductionTotal,
        ];

        $breakdown = [];
        $grossEarning = 0;
        $totalDeduction = 0;

        foreach ($components as $component) {
            $override = $overrides->get($component->id);

            // "Upah Per Hari" itu RATE referensi, bukan nilai yang langsung dijumlah ke gross
            // (nilainya sudah "dipakai" lewat komponen attendance_earning/overtime_regular/dst).
            // Tetap ditampilkan di breakdown supaya slip gaji transparan soal dasar hitungnya.
            if ($component->calculation_type === 'daily_wage_rate') {
                $breakdown[] = ['name' => $component->component_name, 'type' => 'reference', 'calc' => $component->calculation_type, 'value' => round($dailyWage, 2)];
                continue;
            }

            $value = $this->resolveComponentValue($component, $override, $ctx);

            $breakdown[] = ['name' => $component->component_name, 'type' => $component->component_type, 'calc' => $component->calculation_type, 'value' => round($value, 2)];

            if ($component->component_type === 'earning') $grossEarning += $value;
            else $totalDeduction += $value;
        }

        // Tambahkan metadata jam lembur (biasa & merah) ke breakdown agar bisa dibaca normalizeSlip
        $breakdown[] = [
            'name'  => '_meta_overtime_regular_hours',
            'type'  => 'meta',
            'calc'  => 'overtime_regular_hours',
            'value' => $ctx['overtime_regular_hours'] ?? 0,
        ];
        $breakdown[] = [
            'name'  => '_meta_overtime_holiday_hours',
            'type'  => 'meta',
            'calc'  => 'overtime_holiday_hours',
            'value' => $ctx['overtime_holiday_hours'] ?? 0,
        ];

        // Tambahkan potongan manual ke breakdown & total deduction
        if ($manualDeductionTotal > 0) {
            $breakdown[] = [
                'name'  => 'Potongan Manual',
                'type'  => 'deduction',
                'calc'  => 'manual_deduction',
                'value' => round($manualDeductionTotal, 2),
            ];
            $totalDeduction += $manualDeductionTotal;
        }

        $netSalary = $grossEarning - $totalDeduction;

        return PayrollDetail::updateOrCreate(
            ['payroll_id' => $payroll->id, 'employee_id' => $employee->id],
            [
                'total_work_days'      => $hariHadirMurni,
                'total_work_hours'     => round($summaries->sum('productive_work_minutes') / 60, 2),
                'total_overtime_hours' => ($ctx['overtime_regular_hours'] ?? 0) + ($ctx['overtime_holiday_hours'] ?? 0),
                'component_breakdown'  => $breakdown,
                'gross_salary'         => round($grossEarning, 2),
                'total_deduction'      => round($totalDeduction, 2),
                'net_salary'           => round($netSalary, 2),
            ]
        );
    }

    protected function resolveComponentValue(CompanySalaryComponent $component, ?EmployeeSalaryComponent $override, array $ctx): float
    {
        // Override manual per-karyawan selalu menang kalau diisi (mis. koreksi khusus 1 orang).
        if ($override?->custom_value !== null) return (float) $override->custom_value;

        $dailyWage = $ctx['daily_wage'];

        return match ($component->calculation_type) {
            // ── Tipe lama, tetap didukung untuk komponen tambahan (tunjangan, BPJS, dll) ──
            'fixed' => (float) ($component->base_value ?? 0),
            'percentage' => $dailyWage * $ctx['hari_kerja_efektif'] * ((float) ($component->base_value ?? 0) / 100),
            'per_hari' => (float) ($component->base_value ?? 0) * $ctx['hari_hadir'],
            'formula' => $this->evalSimpleFormula($component->formula, ['base_salary' => $dailyWage * $ctx['hari_kerja_efektif']]),

            // ── Formula upah harian spesifik ──
            // attendance_earning = gaji penuh sesuai hari kerja efektif (bukan hanya hari hadir)
            // Potongan absen dihitung terpisah di absence_deduction
            'attendance_earning' => $dailyWage * $ctx['hari_kerja_efektif'],
            // Lembur hanya dari SPL yang di-approve, sudah di-floor ke jam penuh
            'overtime_regular' => ($dailyWage / 7) * ($ctx['overtime_regular_hours'] ?? (int)floor($ctx['overtime_regular_minutes'] / 60)),
            'overtime_holiday' => (float) ($component->base_value ?? 0) * ($ctx['overtime_holiday_hours'] ?? (int)floor($ctx['overtime_holiday_minutes'] / 60)),
            'absence_deduction' => $dailyWage * $ctx['hari_absen'],
            'early_leave_deduction' => $dailyWage > 0 ? ($dailyWage / 8 / 60) * $ctx['early_leave_minutes'] : 0,

            default => 0, // 'manual' -> harus diisi lewat employee_salary_components override
        };
    }

    /** Evaluator formula SANGAT terbatas & aman (tanpa eval()) — hanya mendukung "base_salary * X" atau "base_salary + X". */
    protected function evalSimpleFormula(?string $formula, array $vars): float
    {
        if (! $formula) return 0;
        $formula = trim($formula);

        if (preg_match('/^base_salary\s*\*\s*([\d.]+)$/', $formula, $m)) return $vars['base_salary'] * (float) $m[1];
        if (preg_match('/^base_salary\s*\+\s*([\d.]+)$/', $formula, $m)) return $vars['base_salary'] + (float) $m[1];
        if (preg_match('/^base_salary\s*-\s*([\d.]+)$/', $formula, $m)) return $vars['base_salary'] - (float) $m[1];

        return 0;
    }
}
