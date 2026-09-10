<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Hapus duplikat yang mungkin sudah ada sebelum constraint ditambahkan
        DB::statement("
            DELETE m1 FROM device_employee_mappings m1
            INNER JOIN device_employee_mappings m2
            WHERE m1.device_id = m2.device_id
              AND m1.employee_id = m2.employee_id
              AND m1.device_pin = m2.device_pin
              AND m1.id < m2.id
        ");

        // Unique: 1 karyawan hanya boleh punya 1 mapping per device
        Schema::table('device_employee_mappings', function (Blueprint $table) {
            if (! $this->uniqueExists('device_employee_mappings', 'dem_device_employee_unique')) {
                $table->unique(['device_id', 'employee_id'], 'dem_device_employee_unique');
            }
        });
    }

    public function down(): void
    {
        Schema::table('device_employee_mappings', function (Blueprint $table) {
            $table->dropUnique('dem_device_employee_unique');
        });
    }

    private function uniqueExists(string $table, string $indexName): bool
    {
        $indexes = DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$indexName]);
        return count($indexes) > 0;
    }
};
