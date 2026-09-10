<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\AttendanceDevice;
use App\Services\Attendance\AttendanceCalculationService;
use Illuminate\Support\Facades\Log;

class SyncAllFingerspotDevices extends Command
{
    protected $signature   = 'fingerspot:sync-all {--date= : Tanggal spesifik (Y-m-d), default hari ini} {--days=1 : Jumlah hari ke belakang}';
    protected $description = 'Sync semua mesin absensi Fingerspot yang aktif secara otomatis';

    public function handle(AttendanceCalculationService $calcService): int
    {
        $days = (int) $this->option('days');
        $targetDate = $this->option('date')
            ? \Carbon\Carbon::parse($this->option('date'))
            : now(\App\Models\Company::first()?->timezone ?? 'Asia/Jakarta');

        $dates = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $dates[] = $targetDate->copy()->subDays($i)->format('Y-m-d');
        }

        $devices = AttendanceDevice::where('status', 'active')->get();

        if ($devices->isEmpty()) {
            $this->info('Tidak ada mesin aktif.');
            return 0;
        }

        $this->info("Sync {$devices->count()} mesin untuk " . count($dates) . " tanggal: " . implode(', ', $dates));
        $totalInserted = 0;

        foreach ($devices as $device) {
            foreach ($dates as $date) {
                try {
                    $controller = app(\App\Http\Controllers\Api\AttendanceDeviceController::class);
                    $ref = new \ReflectionMethod($controller, 'runSyncForDate');
                    $ref->setAccessible(true);
                    [$inserted, , , $affectedEmpIds] = $ref->invoke($controller, $device, $date);
                    $totalInserted += $inserted;

                    foreach ($affectedEmpIds as $empId) {
                        try { $calcService->calculateForEmployeeDate($empId, $date); } catch (\Throwable $e) {}
                    }

                    $this->line("  ✓ {$device->name} [{$date}]: {$inserted} log baru");
                } catch (\Throwable $e) {
                    $this->warn("  ✗ {$device->name} [{$date}]: " . $e->getMessage());
                    Log::error("fingerspot:sync-all gagal", ['device' => $device->name, 'date' => $date, 'error' => $e->getMessage()]);
                }
            }
        }

        $this->info("Selesai. Total {$totalInserted} log baru.");
        return 0;
    }
}
