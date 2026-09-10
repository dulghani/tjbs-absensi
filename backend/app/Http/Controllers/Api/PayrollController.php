<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\CalculatePayrollJob;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\CompanyEffectiveWorkDays;
use App\Models\CompanyOvertimeRate;
use App\Models\CompanySalaryComponent;
use App\Models\CompanyWorkSetting;
use App\Models\Payroll;
use Illuminate\Http\Request;

class PayrollController extends Controller
{
    public function index(Request $request)
    {
        $query = Payroll::with('company:id,name');
        if ($request->company_id && $request->company_id !== 'all') $query->where('company_id', $request->company_id);
        return response()->json(['data' => $query->latest('period_year')->latest('period_month')->get()]);
    }

    public function show(string $id)
    {
        return response()->json(['data' => Payroll::with(['company', 'details.employee'])->findOrFail($id)]);
    }

    /**
     * Proses payroll baru. Perhitungan detail (per komponen gaji, lembur, dst)
     * idealnya dijalankan sebagai queued Job terpisah (PayrollCalculationJob)
     * yang menarik data dari attendance_summaries + company_work_settings +
     * company_salary_components. Di sini disediakan kerangka awalnya.
     */
    public function process(Request $request)
    {
        $data = $request->validate([
            'company_id'          => 'required|uuid|exists:companies,id',
            'period_month'        => 'required|integer|min:1|max:12',
            'period_year'         => 'required|integer|min:2020',
            'date_from'           => 'nullable|date',
            'date_to'             => 'nullable|date|after_or_equal:date_from',
            'effective_work_days' => 'nullable|integer|min:1|max:31',
            'division_id'         => 'nullable|uuid|exists:divisions,id',
            'department'          => 'nullable|string|max:255',
        ]);

        $company = Company::withCount('employees')->findOrFail($data['company_id']);

        // Default date range: bulan kalender (1 s.d. akhir bulan)
        // User bisa override ke mis. 25 bulan lalu s.d. 24 bulan ini
        $dateFrom = $data['date_from'] ?? now()->setDate($data['period_year'], $data['period_month'], 1)->format('Y-m-d');
        $dateTo   = $data['date_to']   ?? now()->setDate($data['period_year'], $data['period_month'], 1)->endOfMonth()->format('Y-m-d');

        $effectiveDays = $data['effective_work_days'] ?? CompanyEffectiveWorkDays::where('company_id', $data['company_id'])
            ->where('period_month', $data['period_month'])
            ->where('period_year', $data['period_year'])
            ->value('effective_days');

        // Label scope untuk tampilan (mis. "WIN JATAYU - ITE")
        $scopeParts = [];
        if (! empty($data['division_id'])) $scopeParts[] = \App\Models\Division::find($data['division_id'])?->name ?? '';
        if (! empty($data['department']))   $scopeParts[] = $data['department'];
        $scopeLabel = implode(' - ', array_filter($scopeParts)) ?: null;

        $payroll = Payroll::updateOrCreate(
            [
                'company_id'    => $data['company_id'],
                'period_month'  => $data['period_month'],
                'period_year'   => $data['period_year'],
                'division_id'   => $data['division_id'] ?? null,
                'department'    => $data['department'] ?? null,
            ],
            [
                'status'              => 'processing',
                'date_from'           => $dateFrom,
                'date_to'             => $dateTo,
                'effective_work_days' => $effectiveDays,
                'scope_label'         => $scopeLabel,
                'generated_by'        => $request->user()->id,
                'generated_at'        => now(),
                'employee_count'      => 0, // akan diupdate oleh job
            ]
        );

        // Hitung gaji langsung (sync) — tidak perlu queue:work
        // Untuk payroll besar (>200 karyawan), pertimbangkan naikkan max_execution_time
        try {
            $calcService = app(\App\Services\Payroll\PayrollCalculationService::class);
            $calcService->calculateForPayroll($payroll->fresh());
            $payroll->update(['status' => 'processing']); // tetap processing sampai di-finalisasi manual
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Payroll calculation failed', [
                'payroll_id' => $payroll->id,
                'error'      => $e->getMessage(),
            ]);
        }

        AuditLog::record([
            'company_id'      => $payroll->company_id,
            'action_category' => 'create',
            'entity_type'     => 'payroll',
            'entity_id'       => $payroll->id,
            'entity_name'     => "Payroll {$company->name} {$data['period_month']}/{$data['period_year']}" . ($scopeLabel ? " ({$scopeLabel})" : ''),
        ]);

        return response()->json(['data' => $payroll], 201);
    }

    public function finalize(string $id)
    {
        $payroll = Payroll::findOrFail($id);
        $payroll->update(['status' => 'finalized', 'finalized_at' => now()]);

        AuditLog::record(['company_id' => $payroll->company_id, 'action_category' => 'approve', 'entity_type' => 'payroll', 'entity_id' => $payroll->id, 'entity_name' => "Payroll {$payroll->period_month}/{$payroll->period_year}", 'changes_summary' => 'Payroll difinalisasi']);

        return response()->json(['data' => $payroll]);
    }

    /** Hapus payroll yang belum difinalisasi beserta semua detail-nya */
    public function destroy(string $id)
    {
        $payroll = Payroll::findOrFail($id);

        if ($payroll->status === 'finalized') {
            return response()->json(['message' => 'Payroll yang sudah difinalisasi tidak dapat dihapus.'], 422);
        }

        \App\Models\PayrollDetail::where('payroll_id', $id)->delete();
        $payroll->delete();

        return response()->json(['message' => 'Payroll berhasil dihapus.']);
    }

    /** Hitung ulang payroll yang belum difinalisasi */
    public function recalculate(string $id)
    {
        $payroll = Payroll::findOrFail($id);

        if ($payroll->status === 'finalized') {
            return response()->json(['message' => 'Payroll yang sudah difinalisasi tidak dapat dihitung ulang.'], 422);
        }

        \App\Models\PayrollDetail::where('payroll_id', $id)->delete();
        $payroll->update(['status' => 'processing']);

        $calcService = app(\App\Services\Payroll\PayrollCalculationService::class);
        $calcService->calculateForPayroll($payroll->fresh());

        AuditLog::record(['company_id' => $payroll->company_id, 'action_category' => 'update', 'entity_type' => 'payroll', 'entity_id' => $payroll->id, 'entity_name' => "Payroll {$payroll->period_month}/{$payroll->period_year}", 'changes_summary' => 'Hitung ulang payroll']);

        return response()->json(['data' => $payroll->fresh()]);
    }

    /** Koreksi manual satu karyawan dalam payroll */
    public function updateDetail(Request $request, string $id, string $employeeId)
    {
        $payroll = Payroll::findOrFail($id);

        if ($payroll->status === 'finalized') {
            return response()->json(['message' => 'Payroll sudah difinalisasi, tidak bisa dikoreksi.'], 422);
        }

        $data = $request->validate([
            'gross_salary'    => 'required|numeric|min:0',
            'total_deduction' => 'required|numeric|min:0',
            'notes'           => 'nullable|string|max:500',
        ]);

        $detail = \App\Models\PayrollDetail::where('payroll_id', $id)
            ->where('employee_id', $employeeId)
            ->firstOrFail();

        $netSalary = $data['gross_salary'] - $data['total_deduction'];

        $detail->update([
            'gross_salary'    => $data['gross_salary'],
            'total_deduction' => $data['total_deduction'],
            'net_salary'      => $netSalary,
            'notes'           => $data['notes'] ?? null,
        ]);

        // Update total payroll
        $totals = \App\Models\PayrollDetail::where('payroll_id', $id)
            ->selectRaw('SUM(gross_salary) as total_gross, SUM(net_salary) as total_net')
            ->first();
        $payroll->update(['total_gross' => $totals->total_gross, 'total_net' => $totals->total_net]);

        AuditLog::record([
            'company_id'      => $payroll->company_id,
            'action_category' => 'update',
            'entity_type'     => 'payroll_detail',
            'entity_id'       => $detail->id,
            'changes_summary' => "Koreksi manual: gross={$data['gross_salary']}, net={$netSalary}",
        ]);

        return response()->json(['data' => $detail->fresh()]);
    }

    // ── Work Settings (Aturan Kerja per Perusahaan) ──────────────────────────────
    public function getWorkSettings(string $companyId)
    {
        $setting = CompanyWorkSetting::where('company_id', $companyId)->latest('effective_date')->first();
        return response()->json(['data' => $setting]);
    }

    public function updateWorkSettings(Request $request, string $companyId)
    {
        $data = $request->validate([
            'work_start_time' => 'required',
            'work_end_time' => 'required',
            'break_duration_minutes' => 'nullable|integer',
            'work_days' => 'nullable|array',
            'daily_hours_override' => 'nullable|array',
            'business_date_cutoff' => 'nullable|string|max:5',
            'overtime_min_minutes' => 'nullable|integer',
            'late_tolerance_minutes' => 'nullable|integer',
            'effective_date' => 'nullable|date',
        ]);

        // Versioning: setting lama TIDAK di-overwrite, insert record baru dengan
        // effective_date baru. Default = hari ini (bukan bulan depan) supaya
        // admin tidak lupa setting tidak berlaku untuk data yang sudah ada.
        // Admin bisa set effective_date ke tanggal lebih awal untuk data historis.
        $setting = CompanyWorkSetting::create($data + [
            'company_id' => $companyId,
            'effective_date' => $data['effective_date'] ?? now()->format('Y-m-d'),
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $setting], 201);
    }

    // ── Salary Components ────────────────────────────────────────────────────────
    public function salaryComponents(string $companyId)
    {
        return response()->json(['data' => CompanySalaryComponent::where('company_id', $companyId)->orderBy('sort_order')->get()]);
    }

    public function storeSalaryComponent(Request $request)
    {
        $data = $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'component_name' => 'required|string|max:255',
            'component_type' => 'required|in:earning,deduction',
            'calculation_type' => 'required|in:fixed,percentage,formula,manual,per_hari,daily_wage_rate,overtime_holiday,attendance_earning,overtime_regular,absence_deduction,early_leave_deduction',
            'base_value' => 'nullable|numeric',
            'formula' => 'nullable|string',
            'is_taxable' => 'nullable|boolean',
        ]);

        $component = CompanySalaryComponent::create($data);
        return response()->json(['data' => $component], 201);
    }

    public function updateSalaryComponent(Request $request, string $id)
    {
        $component = CompanySalaryComponent::findOrFail($id);

        $data = $request->validate([
            'component_name' => 'sometimes|string|max:255',
            'component_type' => 'sometimes|in:earning,deduction',
            'calculation_type' => 'sometimes|in:fixed,percentage,formula,manual,per_hari,daily_wage_rate,overtime_holiday,attendance_earning,overtime_regular,absence_deduction,early_leave_deduction',
            'base_value' => 'nullable|numeric',
            'formula' => 'nullable|string',
            'is_taxable' => 'nullable|boolean',
        ]);

        $component->update($data);
        return response()->json(['data' => $component]);
    }

    public function deleteSalaryComponent(string $id)
    {
        CompanySalaryComponent::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    // ── Overtime Rate Tiers ───────────────────────────────────────────────────────
    public function overtimeRates(string $companyId)
    {
        return response()->json(['data' => CompanyOvertimeRate::where('company_id', $companyId)->orderBy('day_type')->orderBy('tier_order')->get()]);
    }

    public function storeOvertimeRate(Request $request)
    {
        $data = $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'day_type' => 'required|in:weekday,weekend,holiday',
            'tier_order' => 'required|integer|min:1',
            'hour_from' => 'required|integer|min:1',
            'hour_to' => 'nullable|integer|min:1',
            'multiplier' => 'nullable|numeric|min:0',
            'fixed_amount' => 'nullable|numeric|min:0',
        ]);

        $rate = CompanyOvertimeRate::create($data);
        return response()->json(['data' => $rate], 201);
    }

    public function updateOvertimeRate(Request $request, string $id)
    {
        $rate = CompanyOvertimeRate::findOrFail($id);

        $data = $request->validate([
            'day_type' => 'sometimes|in:weekday,weekend,holiday',
            'tier_order' => 'sometimes|integer|min:1',
            'hour_from' => 'sometimes|integer|min:1',
            'hour_to' => 'nullable|integer|min:1',
            'multiplier' => 'nullable|numeric|min:0',
            'fixed_amount' => 'nullable|numeric|min:0',
        ]);

        $rate->update($data);
        return response()->json(['data' => $rate]);
    }

    public function deleteOvertimeRate(string $id)
    {
        CompanyOvertimeRate::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    // ── Hari Kerja Efektif Bulanan ────────────────────────────────────────────────
    public function effectiveWorkDays(string $companyId)
    {
        return response()->json(['data' => CompanyEffectiveWorkDays::where('company_id', $companyId)
            ->orderByDesc('period_year')->orderByDesc('period_month')->limit(24)->get()]);
    }

    public function storeEffectiveWorkDays(Request $request)
    {
        $data = $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'period_month' => 'required|integer|min:1|max:12',
            'period_year' => 'required|integer|min:2020',
            'effective_days' => 'required|integer|min:1|max:31',
        ]);

        $record = CompanyEffectiveWorkDays::updateOrCreate(
            ['company_id' => $data['company_id'], 'period_month' => $data['period_month'], 'period_year' => $data['period_year']],
            ['effective_days' => $data['effective_days']]
        );

        return response()->json(['data' => $record], 201);
    }

    public function deleteEffectiveWorkDays(string $id)
    {
        CompanyEffectiveWorkDays::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }
}
