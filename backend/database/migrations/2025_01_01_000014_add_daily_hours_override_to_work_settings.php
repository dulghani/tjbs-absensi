<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_work_settings', function (Blueprint $table) {
            // Override jam kerja per hari tertentu, contoh Sabtu jam kerja lebih pendek.
            // Struktur JSON: {"6": {"start_time": "07:00", "end_time": "12:00"}}
            // Key = ISO day number (1=Senin..7=Minggu). Hari yang TIDAK ada di sini
            // pakai work_start_time/work_end_time global sebagai default.
            $table->json('daily_hours_override')->nullable()->after('work_days');
        });
    }

    public function down(): void
    {
        Schema::table('company_work_settings', function (Blueprint $table) {
            $table->dropColumn('daily_hours_override');
        });
    }
};
