<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_summaries', function (Blueprint $table) {
            // null = lembur di bawah ambang batas (tidak perlu verifikasi)
            // true = lembur > 1 jam DAN ada pengajuan lembur disetujui yang cocok -> hijau
            // false = lembur > 1 jam TAPI tidak ada pengajuan lembur -> kuning (warning)
            $table->boolean('overtime_verified')->nullable()->after('overtime_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_summaries', function (Blueprint $table) {
            $table->dropColumn('overtime_verified');
        });
    }
};
