<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Jumlah hari kerja efektif per bulan, dikelola di tab "Jam Kerja" supaya bisa
        // disiapkan di muka (bukan cuma diisi mendadak saat proses payroll). Payroll::process()
        // pakai ini sebagai DEFAULT kalau user tidak override manual saat itu.
        Schema::create('company_effective_work_days', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->integer('period_month');
            $table->integer('period_year');
            $table->integer('effective_days');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            // Nama index eksplisit karena nama auto-generate Laravel (69 char) melebihi
            // limit MySQL 64 karakter untuk identifier name.
            $table->unique(['company_id', 'period_month', 'period_year'], 'co_eff_days_uniq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_effective_work_days');
    }
};
