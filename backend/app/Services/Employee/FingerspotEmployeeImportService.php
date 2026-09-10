<?php

namespace App\Services\Employee;

use App\Models\AttendanceDevice;
use App\Models\Company;
use App\Models\DeviceEmployeeMapping;
use App\Models\Employee;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Import karyawan dari file export resmi Fingerspot Cloud.
 *
 * Format kolom file export Fingerspot (berdasarkan file nyata):
 *   ID | NIK | Nama di perangkat absensi | Nama Depan | Nama Belakang |
 *   Jenis Kelamin | Tanggal Bergabung | Kantor | Jabatan | WhatsApp | Telegram | ...
 *
 * CATATAN PENTING dari analisis file nyata:
 *   - Kolom "Jabatan" = kode DEPARTEMEN di Fingerspot (BLANKING, ITE, INJECT, dll),
 *     BUKAN jabatan pekerjaan (Operator, Security, dll). Di-map ke employee.department.
 *   - Kolom "ID" = PIN mesin (dipakai untuk device mapping).
 *   - Kolom "NIK" = NIK karyawan yang sebenarnya (bisa beda dari ID untuk multi-device).
 *   - Baris 2 berisi notes panjang dari Fingerspot — dilewati otomatis (ID bukan angka valid).
 *   - Kolom telepon bisa bernama "Telp" atau "WhatsApp" — keduanya dicoba.
 *
 * Logika upsert per-baris:
 *   1. Cek device mapping (device_id + PIN) → karyawan ditemukan → UPDATE
 *   2. Cek NIK dalam perusahaan → karyawan ditemukan → UPDATE + tambah mapping
 *   3. Tidak ditemukan → CREATE baru + tambah mapping
 */
class FingerspotEmployeeImportService
{
    // Kolom WAJIB ada. Kolom opsional ditangani dengan fallback.
    public const REQUIRED_COLUMNS = ['ID', 'Nama Depan', 'Kantor'];

    public function importFromFile(
        string      $filePath,
        ?string     $companyId = null,
        ?string     $deviceId = null,
        ?callable   $onProgress = null
    ): array {
        if (! file_exists($filePath)) {
            throw new \RuntimeException("File tidak ditemukan: {$filePath}");
        }

        $spreadsheet = IOFactory::load($filePath);
        $rows = $spreadsheet->getActiveSheet()->toArray(null, true, true, false);

        if (empty($rows)) {
            throw new \RuntimeException('File kosong atau tidak bisa dibaca.');
        }

        // Baris pertama = header
        $header = array_map('trim', $rows[0]);

        foreach (self::REQUIRED_COLUMNS as $col) {
            if (! in_array($col, $header, true)) {
                throw new \RuntimeException(
                    "Kolom wajib '{$col}' tidak ditemukan. Kolom yang terbaca: " . implode(', ', $header)
                );
            }
        }

        $idx = array_flip($header); // nama kolom → indeks numerik

        // Kolom opsional — coba beberapa alias
        $colNIK     = $idx['NIK'] ?? null;
        $colBelakang = $idx['Nama Belakang'] ?? null;
        $colGender  = $idx['Jenis Kelamin'] ?? null;
        $colJoinDate = $idx['Tanggal Bergabung'] ?? null;
        $colJabatan = $idx['Jabatan'] ?? null;
        $colTelp    = $idx['WhatsApp'] ?? $idx['Telp'] ?? $idx['No HP'] ?? null; // beberapa alias

        $device = $deviceId ? AttendanceDevice::findOrFail($deviceId) : null;
        $created = 0; $updated = 0; $mapped = 0; $skipped = 0;
        $companyCache = []; $divisionCache = []; $companiesCreated = [];

        $dataRows = array_slice($rows, 1);
        $total = count($dataRows);

        foreach ($dataRows as $i => $row) {
            if ($onProgress) $onProgress($i + 1, $total);

            $pinRaw = $row[$idx['ID']] ?? null;

            // Skip baris kosong, baris notes (ID bukan numerik), atau baris header ganda
            if ($pinRaw === null || $pinRaw === '' || ! is_numeric(trim((string) $pinRaw))) {
                $skipped++;
                continue;
            }

            $pin = (string) (int) trim((string) $pinRaw); // normalisasi: "635.0" → "635"

            // Ekstrak field dari row
            $namaDepan    = trim((string) ($row[$idx['Nama Depan']] ?? ''));
            $namaBelakang = $colBelakang !== null ? trim((string) ($row[$colBelakang] ?? '')) : '';
            $fullName     = trim("{$namaDepan} {$namaBelakang}");
            $kantor       = trim((string) ($row[$idx['Kantor']] ?? ''));
            $gender       = $colGender !== null ? (trim((string) ($row[$colGender] ?? '')) ?: null) : null;
            $joinDate     = $colJoinDate !== null ? $this->parseDate($row[$colJoinDate] ?? null) : null;
            $department   = $colJabatan !== null ? (trim((string) ($row[$colJabatan] ?? '')) ?: null) : null;
            $telp         = $colTelp !== null ? (trim((string) ($row[$colTelp] ?? '')) ?: null) : null;

            // NIK di file Fingerspot = nomor urut auto-generated PER PERANGKAT, bukan NIK asli.
            // NIK=191 bisa dimiliki 48 karyawan BERBEDA di perangkat berbeda.
            // Kunci unik yang benar adalah PIN (kolom ID) yang unik per karyawan per perangkat.
            // Kita simpan PIN sebagai employee.nik supaya konsisten dengan data dari auto-sync.
            $nikRaw = $colNIK !== null ? trim((string) ($row[$colNIK] ?? '')) : '';
            // Simpan NIK asli hanya sebagai referensi, JANGAN pakai sebagai kunci upsert

            if (! $fullName) $fullName = "Karyawan PIN-{$pin}";

            $rowCompanyId = $companyId
                ?? ($device?->company_id)
                ?? $this->findCompanyByName($kantor, $companyCache);

            if (! $rowCompanyId) { $skipped++; continue; }

            $divisionId = $this->resolveDivisionId($kantor, $rowCompanyId, $divisionCache);

            // ─── Upsert by PIN (bukan NIK) ────────────────────────────────────────────
            // Kunci: company_id + nik=PIN (bukan NIK dari kolom NIK file)
            // Ini konsisten dengan auto-create dari sync absensi yang juga simpan PIN sebagai NIK.
            $employee = null;

            // 1. Cari via device mapping (paling akurat kalau deviceId ada)
            if ($device) {
                $mapping = DeviceEmployeeMapping::where('device_id', $device->id)
                    ->where('device_pin', $pin)->where('status', 'active')->first();
                if ($mapping) $employee = Employee::find($mapping->employee_id);
            }

            // 2. Cari via PIN yang tersimpan sebagai NIK di perusahaan ini
            if (! $employee) {
                $employee = Employee::where('company_id', $rowCompanyId)->where('nik', $pin)->first();
            }

            // 3. Buat baru — pakai PIN sebagai NIK
            if (! $employee) {
                $employee = Employee::create([
                    'company_id'  => $rowCompanyId,
                    'division_id' => $divisionId,
                    'nik'         => $pin,
                    'name'        => $fullName,
                    'gender'      => in_array($gender, ['L', 'P'], true) ? $gender : null,
                    'department'  => $department,
                    'join_date'   => $joinDate,
                    'phone'       => $telp,
                    'status'      => 'active',
                    'employment_status' => 'contract',
                ]);
                $created++;
            } else {
                $employee->update(array_filter([
                    'name'        => $fullName,
                    'gender'      => in_array($gender, ['L', 'P'], true) ? $gender : null,
                    'department'  => $department ?: $employee->department,
                    'division_id' => $divisionId ?? $employee->division_id,
                    'join_date'   => $joinDate ?? $employee->join_date?->format('Y-m-d'),
                    'phone'       => $telp ?: $employee->phone,
                ], fn ($v) => $v !== null));
                $updated++;
            }

            // Buat/update device mapping pakai PIN (ID) dari file
            if ($device) {
                $wasNew = DeviceEmployeeMapping::updateOrCreate(
                    ['device_id' => $device->id, 'device_pin' => $pin],
                    ['employee_id' => $employee->id, 'status' => 'active']
                )->wasRecentlyCreated;
                if ($wasNew) $mapped++;
            }
        }

        return [
            'created' => $created, 'updated' => $updated,
            'mapped' => $mapped, 'skipped' => $skipped,
            'total' => $total, 'companies_created' => $companiesCreated,
        ];
    }

    /**
     * Cari company berdasarkan nama (case-insensitive, partial match).
     * Berbeda dari resolveCompanyId lama — ini TIDAK auto-create perusahaan baru.
     * Kalau tidak ketemu → return null, baris di-skip.
     */
    protected function findCompanyByName(string $kantorName, array &$cache): ?string
    {
        if (! $kantorName) return null;
        if (isset($cache[$kantorName])) return $cache[$kantorName];

        $company = Company::whereRaw('LOWER(name) = ?', [strtolower($kantorName)])->first();
        if (! $company) {
            $company = Company::whereRaw('LOWER(name) LIKE ?', ['%' . strtolower($kantorName) . '%'])->first();
        }

        $result = $company?->id ?? null;
        $cache[$kantorName] = $result;
        return $result;
    }

    /**
     * Resolve division_id dari nilai Kantor.
     * Kalau divisi belum ada → auto-create di bawah company yang sama.
     * Ini memastikan WIN JATAYU, WIN ITE, WIN PAKAL (dll) selalu terbuat
     * meski belum di-setup manual di Struktur Organisasi.
     */
    protected function resolveDivisionId(string $kantor, string $companyId, array &$cache): ?string
    {
        if (! $kantor) return null;
        $key = "{$companyId}|{$kantor}";
        if (array_key_exists($key, $cache)) return $cache[$key];

        $division = \App\Models\Division::where('company_id', $companyId)
            ->whereRaw('LOWER(name) = ?', [strtolower($kantor)])
            ->first();

        if (! $division) {
            // Auto-create: supaya Kantor selalu ter-mapping tanpa perlu setup manual
            $code = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $kantor), 0, 20));
            $division = \App\Models\Division::create([
                'company_id' => $companyId,
                'name'       => $kantor,
                'code'       => $code ?: 'DIV',
                'status'     => 'active',
            ]);
        }

        return $cache[$key] = $division->id;
    }

    protected function parseDate($value): ?string
    {
        if ($value === null || $value === '') return null;
        try {
            if (is_numeric($value)) {
                return ExcelDate::excelToDateTimeObject((float) $value)->format('Y-m-d');
            }
            return \Carbon\Carbon::parse($value)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }
}
