<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Employee;
use App\Services\Attendance\AttendanceCalculationService;

class CalculateAttendanceSummaries extends Command
{
    protected $signature   = 'attendance:calculate-summaries {date?}';
    protected $description = 'Hitung ulang attendance summaries secara sinkron (tanpa queue)';

    public function handle(AttendanceCalculationService $calcService): int
    {
        $date    = $this->argument('date') ?? now('Asia/Jakarta')->format('Y-m-d');
        $employees = Employee::where('status', 'active')->pluck('id');

        $this->info("Hitung {$employees->count()} karyawan untuk tanggal {$date}...");

        foreach ($employees as $empId) {
            try { $calcService->calculateForEmployeeDate($empId, $date); }
            catch (\Throwable $e) {
                $this->warn("Gagal employee {$empId}: " . $e->getMessage());
            }
        }

        $this->info('Selesai.');
        return 0;
    }
}
