<?php

namespace App\Jobs;

use App\Models\AttendanceDevice;
use App\Models\AttendanceLog;
use App\Models\AttendanceSyncLog;
use App\Models\DeviceEmployeeMapping;
use App\Models\Employee;
use App\Services\Attendance\FingerspotService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

// ShouldQueue DIHAPUS — job ini sekarang berjalan sinkron saat dispatch() dipanggil
class SyncFingerspotAttendanceJob
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60;

    public function __construct(
        protected string $deviceId,
        protected string $date,
    ) {}

    public function handle(): void
    {
        $device = AttendanceDevice::findOrFail($this->deviceId);

        $syncLog = AttendanceSyncLog::create([
            'device_id' => $device->id,
            'sync_date' => $this->date,
            'status' => 'running',
            'started_at' => now(),
        ]);

        $inserted = 0; $skipped = 0; $unmapped = 0;
        $affectedEmployeeIds = [];

        try {
            $service = new FingerspotService($device->cloud_id, $device->getDecryptedApiKey());
            $rawLogs = $service->fetchAttendanceLog($this->date);

            $mappings = DeviceEmployeeMapping::where('device_id', $device->id)
                ->where('status', 'active')
                ->pluck('employee_id', 'device_pin');

            foreach ($rawLogs as $raw) {
                [$result, $employeeId] = $this->processSingleLog($device, $raw, $mappings);
                match ($result) {
                    'inserted' => $inserted++,
                    'skipped' => $skipped++,
                    'unmapped' => $unmapped++,
                };
                if ($result === 'inserted' && $employeeId) $affectedEmployeeIds[$employeeId] = true;
            }

            $status = $unmapped > 0 ? 'partial' : 'success';

            $device->update(['last_synced_at' => now(), 'last_sync_status' => $status, 'last_sync_error' => null]);

            $syncLog->update([
                'status' => $status,
                'records_fetched' => count($rawLogs),
                'records_inserted' => $inserted,
                'records_skipped' => $skipped,
                'records_unmapped' => $unmapped,
                'finished_at' => now(),
            ]);

            if ($unmapped > 0) {
                Log::warning("Fingerspot sync: {$unmapped} PIN tidak terpetakan", ['device_id' => $device->id]);
            }

            // Hitung ulang attendance summary sinkron — tanpa queue
            $calcService = app(\App\Services\Attendance\AttendanceCalculationService::class);
            foreach (array_keys($affectedEmployeeIds) as $employeeId) {
                try { $calcService->calculateForEmployeeDate($employeeId, $this->date); }
                catch (\Throwable $e) {
                    Log::warning("Kalkulasi absensi gagal untuk employee {$employeeId}", ['error' => $e->getMessage()]);
                }
            }
        } catch (Throwable $e) {
            $device->update(['last_sync_status' => 'failed', 'last_sync_error' => $e->getMessage()]);
            $syncLog->update(['status' => 'failed', 'error_message' => $e->getMessage(), 'finished_at' => now()]);
            Log::error('Fingerspot sync gagal', ['device_id' => $device->id, 'error' => $e->getMessage()]);
            throw $e;
        }
    }

    protected bool $loggedSampleRaw = false;

    /** @return array{0: string, 1: ?string} [hasil, employee_id] */
    protected function processSingleLog(AttendanceDevice $device, array $raw, $mappings): array
    {
        // Nama field dikonfirmasi dari response asli Fingerspot Cloud API (bukan dokumentasi resmi).
        $pin = (string) ($raw['PIN'] ?? '');
        $scanTimeRaw = $raw['Date Time'] ?? null;

        if ($pin === '' || ! $scanTimeRaw) {
            if (! $this->loggedSampleRaw) {
                Log::warning('Fingerspot sync: record di-skip, field PIN/Date Time tidak ditemukan.', [
                    'device_id' => $device->id, 'raw_record_sample' => $raw, 'available_keys' => array_keys($raw),
                ]);
                $this->loggedSampleRaw = true;
            }
            return ['skipped', null];
        }

        $employeeId = $mappings[$pin] ?? null;

        // PIN belum terpetakan → coba auto-create karyawan dari data yang ada di log.
        // Response Fingerspot sudah mengandung PIN, NIK, Name, Location — cukup untuk bikin
        // karyawan baru tanpa perlu endpoint terpisah. Data lain bisa dilengkapi HRD nanti.
        if (! $employeeId) {
            $employeeId = $this->autoCreateEmployee($device, $pin, $raw);
            if ($employeeId) {
                $mappings[$pin] = $employeeId; // update in-memory supaya record berikutnya pakai mapping baru
            } else {
                return ['unmapped', null];
            }
        }

        $scanTime = Carbon::parse($scanTimeRaw, $device->timezone);

        $created = AttendanceLog::firstOrCreate(
            ['employee_id' => $employeeId, 'device_id' => $device->id, 'logged_time' => $scanTime],
            [
                'company_id' => $device->company_id,
                'line_id' => $device->line_id,
                'log_type' => $this->resolveLogType($raw),
                'biometric_type' => 'fingerprint',
                'verification_status' => 'auto',
            ]
        );

        return [$created->wasRecentlyCreated ? 'inserted' : 'skipped', $employeeId];
    }

    /**
     * Buat karyawan baru dari data log Fingerspot.
     * Field tersedia: PIN, NIK, Name, Location (= nama akun Fingerspot, BUKAN departemen).
     *
     * Untuk department: pakai nama divisi yang terhubung ke device ini (division_id),
     * bukan `Location` dari Fingerspot (yang isinya nama akun mesin, mis. "WIN JATAYU").
     * Jabatan/position tidak tersedia dari Fingerspot — harus dilengkapi HRD secara manual.
     */
    protected function autoCreateEmployee(AttendanceDevice $device, string $pin, array $raw): ?string
    {
        try {
            $name = trim($raw['Name'] ?? $raw['name'] ?? '');
            if (! $name) $name = "Karyawan PIN-{$pin}";

            // Cari karyawan existing berdasarkan NIK = PIN
            $employee = Employee::where('company_id', $device->company_id)
                ->where('nik', $pin)
                ->first();

            if (! $employee) {
                $employee = Employee::create([
                    'company_id'         => $device->company_id,
                    'division_id'        => $device->division_id, // FK langsung ke divisi mesin
                    'name'               => $name,
                    'nik'                => $pin,
                    'position'           => $device->default_position,
                    'status'             => 'active',
                    'join_date'          => now()->format('Y-m-d'),
                    'employment_status'  => $device->default_employment_status ?? 'contract',
                ]);

                Log::info("Fingerspot sync: auto-created karyawan [{$name}] PIN={$pin} division_id=[{$device->division_id}] mesin=[{$device->name}]");
            }

            DeviceEmployeeMapping::firstOrCreate(
                ['device_id' => $device->id, 'employee_id' => $employee->id],
                ['device_pin' => $pin, 'status' => 'active']
            );

            return $employee->id;
        } catch (Throwable $e) {
            Log::warning("Fingerspot sync: gagal auto-create karyawan PIN={$pin}", ['error' => $e->getMessage()]);
            return null;
        }
    }

    protected function resolveLogType(array $raw): string
    {
        // Field 'Type' berisi teks bilingual, contoh: "Check Out / Absensi Pulang"
        // atau "Check In / Absensi Masuk". Ini lebih reliable daripada 'Type ID'
        // (angka) karena self-descriptive, jadi jadi sumber utama.
        $typeText = strtolower((string) ($raw['Type'] ?? ''));

        if (str_contains($typeText, 'out') || str_contains($typeText, 'pulang')) return 'check_out';
        if (str_contains($typeText, 'in') || str_contains($typeText, 'masuk')) return 'check_in';

        // Fallback ke 'Type ID' kalau field 'Type' kosong/tidak dikenali.
        // Berdasarkan sampel: Type ID=1 teramati konsisten dengan "Check Out".
        // BELUM ada sampel Check In untuk konfirmasi Type ID=0 — pantau log kalau ada anomali.
        $typeId = $raw['Type ID'] ?? null;
        return ((int) $typeId) === 1 ? 'check_out' : 'check_in';
    }
}
