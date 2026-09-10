<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_work_settings', function (Blueprint $table) {
            // "Batas Potong Hari" (Business Date Cut-off) dalam sistem Hybrid Duration-Based.
            // Scan yang terjadi antara 00:00 s/d (cutoff - 1 menit) dianggap masih bagian dari
            // hari kerja SEBELUMNYA. Default 05:00 — cocok untuk shift malam yang selesai dini hari.
            // Disimpan sebagai string HH:MM supaya tidak ada konversi timezone yang merusak nilai.
            $table->string('business_date_cutoff', 5)->default('05:00')->after('daily_hours_override');
        });
    }

    public function down(): void
    {
        Schema::table('company_work_settings', function (Blueprint $table) {
            $table->dropColumn('business_date_cutoff');
        });
    }
};
