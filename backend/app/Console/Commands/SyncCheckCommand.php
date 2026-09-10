<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\AttendanceDevice;
use App\Services\Attendance\AttendanceCalculationService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SyncCheckCommand extends Command
{
    protected $signature   = 'attendance:sync-check';
    protected $description = 'Cek setiap device apakah sudah waktunya sync, lalu jalankan langsung (sinkron, tanpa queue).';

    public function handle(AttendanceCalculationService $calcService): int
    {
        $devices = AttendanceDevice::where('status', 'active')->get();
        $synced  = 0;
        $today   = now('Asia/Jakarta')->format('Y-m-d');

        foreach ($devices as $device) {
            $interval = $device->sync_interval_minutes ?? 30;
            $cacheKey = "last_sync_run_{$device->id}";
            $lastSync = Cache::get($cacheKey);

            if ($lastSync && now()->diffInMinutes($lastSync) < $interval) continue;

            try {
                $controller = app(\App\Http\Controllers\Api\AttendanceDeviceController::class);
                $ref = new \ReflectionMethod($controller, 'runSyncForDate');
                $ref->setAccessible(true);
                [$inserted, , , $affectedEmpIds] = $ref->invoke($controller, $device, $today);

                foreach ($affectedEmpIds as $empId) {
                    try { $calcService->calculateForEmployeeDate($empId, $today); }
                    catch (\Throwable $e) {}
                }

                Cache::put($cacheKey, now(), now()->addHours(24));
                $this->line("✓ {$device->name}: {$inserted} log baru");
                $synced++;
            } catch (\Throwable $e) {
                $this->warn("✗ {$device->name}: " . $e->getMessage());
                Log::error("sync-check gagal", ['device' => $device->name, 'error' => $e->getMessage()]);
            }
        }

        if ($synced === 0) $this->line('Tidak ada device yang perlu di-sync sekarang.');
        return 0;
    }
}
