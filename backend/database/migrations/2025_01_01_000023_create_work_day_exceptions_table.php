<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_day_exceptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->date('exception_date');
            $table->enum('exception_type', [
                'holiday',          // Hari kerja → libur (libur nasional, cuti bersama)
                'replacement_day',  // Hari libur → kerja pengganti (absen dihitung normal, BUKAN lembur merah)
                'half_day',         // Jam kerja diperpendek (misal: hari raya eve)
            ]);
            // Untuk replacement_day: tanggal hari kerja yang digantikan
            // Contoh: Minggu 30 Agustus menggantikan Senin 24 Agustus (libur nasional)
            $table->date('replaces_date')->nullable();
            $table->integer('half_day_minutes')->nullable(); // Untuk half_day: durasi jam kerja (menit)
            $table->string('description', 255)->nullable();  // "Cuti Bersama HUT RI ke-80"
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'exception_date'], 'work_exc_company_date_unique');
            $table->index(['company_id', 'exception_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_day_exceptions');
    }
};
