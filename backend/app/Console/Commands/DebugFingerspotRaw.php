<?php

namespace App\Console\Commands;

use App\Models\AttendanceDevice;
use App\Services\Attendance\FingerspotService;
use Illuminate\Console\Command;

/**
 * Command diagnostik — dump response MENTAH dari Fingerspot API supaya kita bisa
 * lihat nama field yang sebenarnya dipakai (pin, scan_date, in_out, dll bisa beda
 * per tipe mesin/akun). Hasilnya dipakai untuk menyesuaikan parsing di
 * SyncFingerspotAttendanceJob::processSingleLog() dan resolveLogType().
 */
class DebugFingerspotRaw extends Command
{
    protected $signature = 'fingerspot:debug-raw {device : Attendance Device ID} {--date= : Tanggal, format Y-m-d (default: hari ini)}';

    protected $description = 'Tampilkan response mentah Fingerspot API untuk debugging nama field';

    public function handle(): int
    {
        $device = AttendanceDevice::find($this->argument('device'));
        if (! $device) {
            $this->error('Device tidak ditemukan.');
            return self::FAILURE;
        }

        $date = $this->option('date') ?? now()->format('Y-m-d');
        $this->info("Mengambil data dari Fingerspot untuk device '{$device->name}', tanggal {$date}...");
        $this->info("Waktu server saat ini: " . now()->format('Y-m-d H:i:s T') . " (timezone: " . config('app.timezone') . ")");
        $this->newLine();

        try {
            $service = new FingerspotService($device->cloud_id, $device->getDecryptedApiKey());
            $records = $service->fetchAttendanceLog($date);
        } catch (\Throwable $e) {
            $this->error("Gagal mengambil data: {$e->getMessage()}");
            return self::FAILURE;
        }

        $this->info("Total record: " . count($records));
        $this->newLine();

        if (empty($records)) {
            $this->warn('Tidak ada record untuk tanggal ini. Coba tanggal lain dengan --date=YYYY-MM-DD');
            return self::SUCCESS;
        }

        $this->info('=== 3 CONTOH RECORD PERTAMA (mentah, apa adanya dari Fingerspot) ===');
        foreach (array_slice($records, 0, 3) as $i => $record) {
            $this->line("--- Record #{$i} ---");
            $this->line(json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $this->newLine();
        }

        $this->info('=== DAFTAR NAMA FIELD YANG DITEMUKAN ===');
        $this->line(implode(', ', array_keys($records[0])));

        return self::SUCCESS;
    }
}
