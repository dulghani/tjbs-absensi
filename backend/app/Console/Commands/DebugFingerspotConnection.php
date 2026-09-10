<?php

namespace App\Console\Commands;

use App\Models\AttendanceDevice;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Debug Fingerspot API — tampilkan URL LENGKAP yang dipanggil, response mentah,
 * dan coba beberapa format URL yang umum dipakai Fingerspot.
 *
 * Gunakan ini kalau sync gagal dengan error 404 atau koneksi gagal.
 */
class DebugFingerspotConnection extends Command
{
    protected $signature = 'fingerspot:debug-connection
                            {device : UUID AttendanceDevice}
                            {--date= : Tanggal test, default hari ini (Y-m-d)}';

    protected $description = 'Debug koneksi Fingerspot — tampilkan URL yang dipanggil dan response mentah';

    public function handle(): int
    {
        $device = AttendanceDevice::find($this->argument('device'));
        if (! $device) {
            $this->error('Device tidak ditemukan. Gunakan UUID dari tabel attendance_devices.');
            $this->line('Daftar device yang ada:');
            AttendanceDevice::with('company:id,name')->get()->each(fn ($d) =>
                $this->line("  {$d->id}  [{$d->name}] ({$d->company?->name})")
            );
            return self::FAILURE;
        }

        $cloudId = $device->cloud_id;
        $apiKey  = $device->getDecryptedApiKey();
        $date    = $this->option('date') ?? now()->format('Y-m-d');

        $this->info("Device  : {$device->name}");
        $this->info("Cloud ID: {$cloudId}");
        $this->info("API Key : " . substr($apiKey, 0, 4) . '****' . substr($apiKey, -4));
        $this->info("Tanggal : {$date}");
        $this->newLine();

        // ── Bangun URL persis seperti yang dilakukan sistem ──────────────────────
        $currentTime = Carbon::now()->format('YmdHis');
        $auth = md5($cloudId . $date . $currentTime . $apiKey);

        $urlsToTest = [
            // Format yang sedang dipakai sistem
            "https://api.fingerspot.io/api/download/attendance_log/{$cloudId}/{$date}/6/date_time/asc/json/{$auth}/{$currentTime}",
            // Format alternatif yang kadang dipakai Fingerspot
            "https://api.fingerspot.io/api/v2/download/attendance_log/{$cloudId}/{$date}/json/{$auth}/{$currentTime}",
            "https://api.fingerspot.io/download/attendance_log/{$cloudId}/{$date}/6/date_time/asc/json/{$auth}/{$currentTime}",
        ];

        foreach ($urlsToTest as $i => $url) {
            $this->warn("=== Test URL #" . ($i + 1) . " ===");
            $this->line($url);
            $this->newLine();

            try {
                $response = Http::withOptions(['verify' => false])->timeout(15)->get($url);
                $status = $response->status();
                $this->line("HTTP Status : {$status}");

                if ($response->successful()) {
                    $data = $response->json();
                    $this->info("✓ BERHASIL! Response JSON:");
                    $this->line(json_encode(array_slice($data['data'] ?? $data, 0, 2), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

                    if (! empty($data['data']) || (is_array($data) && count($data) > 0)) {
                        $this->newLine();
                        $this->info("✅ URL ini BENAR — gunakan format ini di FingerspotService.php");
                        $this->line("   Format: " . preg_replace('/' . preg_quote($cloudId) . '.*/', '{cloud_id}/...', $url));
                    }
                } else {
                    $this->error("✗ HTTP {$status}: " . substr($response->body(), 0, 200));
                }
            } catch (\Throwable $e) {
                $this->error("✗ Exception: " . $e->getMessage());
            }

            $this->newLine();
        }

        // ── Checklist manual ─────────────────────────────────────────────────────
        $this->line("=== CHECKLIST KONFIGURASI ===");
        $this->line("1. Pastikan Cloud ID benar (dari dashboard Fingerspot Cloud)");
        $this->line("   → Buka https://cloud.fingerspot.io → Settings → Cloud ID");
        $this->line("   → Cloud ID Anda: {$cloudId}");
        $this->newLine();
        $this->line("2. Pastikan API Key benar");
        $this->line("   → Buka https://cloud.fingerspot.io → Settings → API Key");
        $this->line("   → API Key Anda (4 karakter terakhir): ****" . substr($apiKey, -4));
        $this->newLine();
        $this->line("3. Pastikan subscription Fingerspot Cloud aktif");
        $this->line("   → Cek di dashboard apakah masa berlaku API masih aktif");
        $this->newLine();
        $this->line("4. Coba login ke Fingerspot Cloud dan lihat apakah ada data log untuk tanggal {$date}");

        return self::SUCCESS;
    }
}
