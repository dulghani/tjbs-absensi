<?php

namespace App\Services\Employee;

use App\Models\Company;
use App\Models\DeviceEmployeeMapping;
use App\Models\Employee;
use App\Services\Attendance\FingerspotService;
use Illuminate\Support\Facades\Log;

/**
 * Sinkronisasi data karyawan langsung dari Fingerspot Cloud API,
 * tanpa perlu file Excel.
 *
 * Field yang diharapkan dari API (nama field bisa bervariasi per akun,
 * makanya ada beberapa alias di normalisasi):
 *   PIN / pin / id     → device_pin (identifier unik di mesin)
 *   name / Name        → nama karyawan
 *   department / dept  → departemen (opsional)
 *
 * Logika upsert: PIN = primary key dari sisi Fingerspot. Kalau PIN sudah
 * ada di device_employee_mappings untuk device ini, karyawan di-update.
 * Kalau belum ada, karyawan baru dibuat dan PIN dipetakan ke device ini.
 */
class FingerspotEmployeeSyncService
{
    public function syncFromDevice(string $deviceId, string $cloudId, string $apiKey, string $companyId): array
    {
        $service = new FingerspotService($cloudId, $apiKey);
        $rawEmployees = $service->fetchEmployees();

        if (empty($rawEmployees)) {
            return ['created' => 0, 'updated' => 0, 'skipped' => 0, 'total' => 0, 'error' => null];
        }

        $created = 0; $updated = 0; $skipped = 0;

        foreach ($rawEmployees as $raw) {
            try {
                $normalized = $this->normalizeEmployee($raw);

                if (! $normalized['pin']) {
                    $skipped++;
                    continue; // PIN wajib ada — tanpa PIN tidak bisa dipetakan ke mesin
                }

                $result = $this->upsertEmployee($normalized, $companyId, $deviceId);
                if ($result === 'created') $created++;
                elseif ($result === 'updated') $updated++;
                else $skipped++;
            } catch (\Throwable $e) {
                Log::warning('FingerspotEmployeeSyncService: gagal proses 1 karyawan', [
                    'raw' => $raw,
                    'error' => $e->getMessage(),
                ]);
                $skipped++;
            }
        }

        return [
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'total' => count($rawEmployees),
            'error' => null,
        ];
    }

    /**
     * Normalisasi field dari response Fingerspot ke format internal kita.
     * Field name dari Fingerspot tidak konsisten antar akun, jadi kita
     * coba beberapa alias untuk tiap field penting.
     */
    protected function normalizeEmployee(array $raw): array
    {
        // PIN — identifier unik karyawan di mesin
        $pin = (string) ($raw['PIN'] ?? $raw['pin'] ?? $raw['id'] ?? $raw['user_id'] ?? $raw['no'] ?? '');

        // Nama — coba beberapa kemungkinan nama field
        $firstName = $raw['first_name'] ?? $raw['nama_depan'] ?? '';
        $lastName  = $raw['last_name']  ?? $raw['nama_belakang'] ?? '';
        $fullName  = trim($raw['name'] ?? $raw['Name'] ?? $raw['nama'] ?? $raw['employee_name'] ?? '');

        if (! $fullName && ($firstName || $lastName)) {
            $fullName = trim("$firstName $lastName");
        }

        // Department
        $department = $raw['department'] ?? $raw['dept'] ?? $raw['Department'] ?? $raw['divisi'] ?? null;

        // No HP
        $phone = $raw['phone'] ?? $raw['telp'] ?? $raw['mobile'] ?? null;

        return [
            'pin'        => $pin ?: null,
            'name'       => $fullName ?: "Karyawan-$pin",
            'department' => $department,
            'phone'      => $phone,
            'raw'        => $raw, // simpan mentah untuk debugging
        ];
    }

    protected function upsertEmployee(array $data, string $companyId, string $deviceId): string
    {
        $pin = $data['pin'];

        // Cari karyawan lewat mapping PIN yang sudah ada di device ini
        $existingMapping = DeviceEmployeeMapping::where('device_id', $deviceId)
            ->where('device_pin', $pin)
            ->where('status', 'active')
            ->first();

        if ($existingMapping) {
            // Update nama/departemen kalau ada perubahan
            $employee = Employee::find($existingMapping->employee_id);
            if ($employee) {
                $changed = false;
                if ($data['name'] && $employee->name !== $data['name']) {
                    $employee->name = $data['name'];
                    $changed = true;
                }
                if ($data['department'] && $employee->department !== $data['department']) {
                    $employee->department = $data['department'];
                    $changed = true;
                }
                if ($changed) $employee->save();
            }
            return 'updated';
        }

        // Belum ada mapping → cari karyawan yang NIK-nya cocok dengan PIN
        // (PIN Fingerspot = NIK karyawan di banyak perusahaan)
        $employee = Employee::where('company_id', $companyId)
            ->where(fn ($q) => $q->where('nik', $pin)->orWhere('fingerspot_pin', $pin))
            ->first();

        // Kalau tidak ketemu juga → buat karyawan baru
        if (! $employee) {
            $employee = Employee::create([
                'company_id'    => $companyId,
                'name'          => $data['name'],
                'nik'           => $pin, // Pakai PIN sebagai NIK sementara
                'department'    => $data['department'],
                'phone'         => $data['phone'],
                'status'        => 'active',
                'join_date'     => now()->format('Y-m-d'),
                'employment_status' => 'contract',
            ]);
        }

        // Petakan PIN ke device
        DeviceEmployeeMapping::firstOrCreate(
            ['device_id' => $deviceId, 'employee_id' => $employee->id],
            ['device_pin' => $pin, 'status' => 'active']
        );

        return 'created';
    }
}
