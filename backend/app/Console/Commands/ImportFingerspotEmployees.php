<?php

namespace App\Console\Commands;

use App\Services\Employee\FingerspotEmployeeImportService;
use Illuminate\Console\Command;

/**
 * Import karyawan dari file export Fingerspot Cloud lewat CLI. Logika inti ada di
 * FingerspotEmployeeImportService (dipakai bersama dengan endpoint upload UI).
 */
class ImportFingerspotEmployees extends Command
{
    protected $signature = 'employees:import-fingerspot
                            {file : Path ke file .xlsx (relatif dari storage/app atau path absolut)}
                            {--company= : Company ID tujuan. Jika kosong, dibuat/dicocokkan otomatis dari kolom Kantor}
                            {--device= : Attendance Device ID untuk membuat pemetaan PIN otomatis (opsional)}';

    protected $description = 'Import data karyawan dari file export Fingerspot Cloud (.xlsx)';

    public function handle(FingerspotEmployeeImportService $service): int
    {
        $path = $this->resolveFilePath($this->argument('file'));

        if (! file_exists($path)) {
            $this->error("File tidak ditemukan: {$path}");
            return self::FAILURE;
        }

        $this->info("Membaca file: {$path}");

        $bar = null;
        try {
            $result = $service->importFromFile(
                $path,
                $this->option('company'),
                $this->option('device'),
                function (int $current, int $total) use (&$bar) {
                    if (! $bar) { $bar = $this->output->createProgressBar($total); $bar->start(); }
                    $bar->advance();
                }
            );
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }

        $bar?->finish();
        $this->newLine(2);

        foreach ($result['companies_created'] as $name) {
            $this->line("→ Perusahaan baru dibuat otomatis: {$name}");
        }

        $this->info("Selesai. Dibuat: {$result['created']}, Diperbarui: {$result['updated']}, Dilewati: {$result['skipped']}" . ($this->option('device') ? ", Dipetakan ke PIN: {$result['mapped']}" : ''));

        if (! $this->option('device')) {
            $this->warn('Tidak ada --device yang diisi, jadi pemetaan PIN belum dibuat. Jalankan ulang dengan --device={id} atau petakan manual lewat menu "Integrasi Mesin Absensi".');
        }

        $this->comment('Catatan: kolom NIK pada file sumber tidak unik dan TIDAK dipakai sebagai identifier — sistem memakai PIN mesin (kolom ID) sebagai kunci pencocokan.');

        return self::SUCCESS;
    }

    protected function resolveFilePath(string $file): string
    {
        if (file_exists($file)) return $file;
        $storagePath = storage_path("app/{$file}");
        return file_exists($storagePath) ? $storagePath : $file;
    }
}
