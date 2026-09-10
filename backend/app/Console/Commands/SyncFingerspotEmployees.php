<?php

namespace App\Console\Commands;

use App\Models\AttendanceDevice;
use App\Services\Employee\FingerspotEmployeeSyncService;
use Illuminate\Console\Command;

class SyncFingerspotEmployees extends Command
{
    protected $signature = 'employees:sync-fingerspot-api
                            {--device= : UUID device tertentu (kalau tidak diisi, sync semua device aktif)}
                            {--company= : Filter per company_id}';

    protected $description = 'Sinkronisasi data karyawan langsung dari Fingerspot Cloud API (tanpa file Excel)';

    public function handle(FingerspotEmployeeSyncService $service): int
    {
        $query = AttendanceDevice::where('status', 'active');

        if ($this->option('device')) {
            $query->where('id', $this->option('device'));
        }
        if ($this->option('company')) {
            $query->where('company_id', $this->option('company'));
        }

        $devices = $query->with('company:id,name')->get();

        if ($devices->isEmpty()) {
            $this->warn('Tidak ada device aktif yang ditemukan.');
            return self::SUCCESS;
        }

        $totalCreated = 0; $totalUpdated = 0; $totalSkipped = 0;

        foreach ($devices as $device) {
            $this->line("Syncing karyawan dari: [{$device->name}] ({$device->company?->name})");

            try {
                $result = $service->syncFromDevice(
                    $device->id,
                    $device->cloud_id,
                    $device->getDecryptedApiKey(),
                    $device->company_id,
                );

                $this->info("  ✓ Total: {$result['total']} | Baru: {$result['created']} | Update: {$result['updated']} | Skip: {$result['skipped']}");

                $totalCreated += $result['created'];
                $totalUpdated += $result['updated'];
                $totalSkipped += $result['skipped'];
            } catch (\Throwable $e) {
                $this->error("  ✗ Gagal: {$e->getMessage()}");
            }
        }

        $this->newLine();
        $this->info("Selesai — Baru: {$totalCreated} | Update: {$totalUpdated} | Skip: {$totalSkipped}");

        return self::SUCCESS;
    }
}
