<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('overtime_requests', function (Blueprint $table) {
            // Satu pengajuan lembur bisa mencakup karyawan dari banyak departemen,
            // sehingga field department tidak wajib diisi.
            $table->string('department')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('overtime_requests', function (Blueprint $table) {
            $table->string('department')->nullable(false)->change();
        });
    }
};
