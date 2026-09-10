<?php

namespace App\Jobs;

use App\Services\Attendance\AttendanceCalculationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class CalculateAttendanceSummaryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(
        protected string $employeeId,
        protected string $date,
    ) {}

    public function handle(AttendanceCalculationService $service): void
    {
        try {
            $service->calculateForEmployeeDate($this->employeeId, $this->date);
        } catch (Throwable $e) {
            Log::error('Gagal menghitung attendance summary', [
                'employee_id' => $this->employeeId, 'date' => $this->date, 'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
