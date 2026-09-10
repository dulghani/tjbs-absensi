<?php

namespace App\Jobs;

use App\Models\Employee;
use App\Services\Attendance\AttendanceCalculationService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Satu job master yang menghitung semua karyawan dalam range tanggal.
 * Dipakai supaya HTTP request tidak timeout — HTTP hanya dispatch 1 job ini,
 * lalu queue:work yang handle looping ribuan kalkulasi.
 */
class BatchRecalculateAttendanceJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 3600; // 1 jam maksimal

    public function __construct(
        public string $companyId,
        public string $fromDate,
        public string $toDate,
    ) {}

    public function handle(AttendanceCalculationService $service): void
    {
        $from = Carbon::parse($this->fromDate);
        $to   = Carbon::parse($this->toDate);

        $employees = Employee::where('company_id', $this->companyId)
            ->where('status', 'active')
            ->pluck('id');

        $total = $employees->count() * ($from->diffInDays($to) + 1);
        Log::info("BatchRecalculate START: company={$this->companyId} {$this->fromDate}→{$this->toDate} ({$employees->count()} karyawan, ~{$total} proses)");

        $done = 0;
        $cursor = $from->copy();
        while ($cursor->lte($to)) {
            $dateStr = $cursor->format('Y-m-d');
            foreach ($employees as $empId) {
                try {
                    $service->calculateForEmployeeDate($empId, $dateStr);
                } catch (\Throwable $e) {
                    Log::warning("BatchRecalculate skip: emp={$empId} date={$dateStr} err={$e->getMessage()}");
                }
                $done++;
            }
            $cursor->addDay();
        }

        Log::info("BatchRecalculate DONE: {$done}/{$total} proses selesai.");
    }
}
