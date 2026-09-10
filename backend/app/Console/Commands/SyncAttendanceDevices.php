<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\AttendanceDevice;
use App\Services\Attendance\AttendanceCalculationService;

class SyncAttendanceDevices extends Command
{
    protected $signature   = 'attendance:sync-devices {--date= : Tanggal Y-m-d, default hari ini} {--days=1 : Jumlah hari ke belakang}';
    protected $description = 'Sync semua mesin Fingerspot aktif secara sinkron (tanpa queue)';

    public function handle(AttendanceCalculationService $calcService): int
    {
        $days   = (int) $this->option('days');
        $target = $this->option('date') ? \Carbon\Carbon::parse($this->option('date')) : now('Asia/Jakarta');

        $dates = [];
        for ($i = $days - 1; $i >= 0; $i--)
            $dates[] = $target->copy()->subDays($i)->format('Y-m-d');

        $devices = AttendanceDevice::where('status', 'active')->get();
        if ($devices->isEmpty()) { $this->info('Tidak ada mesin aktif.'); return 0; }

        $this->info("Sync {$devices->count()} mesin × " . count($dates) . " tanggal...");
        $total = 0;

        foreach ($devices as $device) {
            foreach ($dates as $date) {
                try {
                    $controller = app(\App\Http\Controllers\Api\AttendanceDeviceController::class);
                    $ref = new \ReflectionMethod($controller, 'runSyncForDate');
                    $ref->setAccessible(true);
                    [$inserted, , , $affectedEmpIds] = $ref->invoke($controller, $device, $date);
                    $total += $inserted;
                    foreach ($affectedEmpIds as $empId) {
                        try { $calcService->calculateForEmployeeDate($empId, $date); } catch (\Throwable $e) {}
                    }
                    $this->line("  ✓ {$device->name} [{$date}]: {$inserted} log");
                } catch (\Throwable $e) {
                    $this->warn("  ✗ {$device->name} [{$date}]: " . $e->getMessage());
                }
            }
        }
        $this->info("Selesai. Total {$total} log baru.");
        return 0;
    }
}
