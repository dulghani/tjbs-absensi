<?php

namespace App\Jobs;

use App\Models\Payroll;
use App\Services\Payroll\PayrollCalculationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class CalculatePayrollJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 300; // bisa banyak karyawan, kasih waktu lebih

    public function __construct(protected string $payrollId) {}

    public function handle(PayrollCalculationService $service): void
    {
        $payroll = Payroll::findOrFail($this->payrollId);

        try {
            $service->calculateForPayroll($payroll);
        } catch (Throwable $e) {
            Log::error('Gagal menghitung payroll', ['payroll_id' => $this->payrollId, 'error' => $e->getMessage()]);
            throw $e;
        }
    }
}
