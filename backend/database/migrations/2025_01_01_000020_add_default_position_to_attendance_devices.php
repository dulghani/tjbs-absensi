<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_devices', function (Blueprint $table) {
            // Default data untuk karyawan yang auto-dibuat dari mesin ini.
            // Mis: mesin di divisi Produksi → default_position = "Operator Produksi"
            // Sehingga tidak perlu edit manual 1-per-1 setelah auto-create.
            $table->string('default_position', 150)->nullable()->after('division_id');
            $table->enum('default_employment_status', ['permanent', 'contract', 'probation', 'temporary'])
                ->default('contract')->after('default_position');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_devices', function (Blueprint $table) {
            $table->dropColumn(['default_position', 'default_employment_status']);
        });
    }
};
