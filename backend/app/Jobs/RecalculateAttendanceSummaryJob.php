<?php

namespace App\Jobs;

use App\Services\Attendance\AttendanceCalculationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RecalculateAttendanceSummaryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 60;

    public function __construct(
        public string $employeeId,
        public string $date,
    ) {}

    public function handle(AttendanceCalculationService $service): void
    {
        try {
            $service->calculateForEmployeeDate($this->employeeId, $this->date);
        } catch (\Throwable $e) {
            Log::warning("RecalculateAttendanceSummaryJob gagal: emp={$this->employeeId} date={$this->date}", [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
