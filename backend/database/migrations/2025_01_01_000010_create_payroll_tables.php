<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Setting jam kerja per perusahaan - KUNCI fleksibilitas sistem multi-perusahaan.
        Schema::create('company_work_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->time('work_start_time');
            $table->time('work_end_time');
            $table->integer('break_duration_minutes')->default(60);
            $table->json('work_days'); // [1,1,1,1,1,0,0] Senin..Minggu
            $table->integer('overtime_min_minutes')->default(30);
            $table->enum('overtime_calc_method', ['per_hour', 'per_15min', 'flat'])->default('per_hour');
            $table->integer('late_tolerance_minutes')->default(15);
            $table->integer('early_leave_tolerance_minutes')->default(0);
            $table->date('effective_date');
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->index(['company_id', 'effective_date']);
        });

        // Tier multiplier lembur - bisa berjenjang per perusahaan (1.5x jam 1-2, 2x jam 3+, dst)
        Schema::create('company_overtime_rates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->enum('day_type', ['weekday', 'weekend', 'holiday']);
            $table->integer('tier_order');
            $table->integer('hour_from');
            $table->integer('hour_to')->nullable(); // NULL = unlimited
            $table->decimal('multiplier', 4, 2)->nullable();
            $table->decimal('fixed_amount', 15, 2)->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
        });

        // Komponen gaji fleksibel per perusahaan (Gaji Pokok, Tunjangan, BPJS, dll).
        // calculation_type sengaja string (bukan enum) supaya gampang tambah tipe baru
        // ke depan tanpa migration ALTER TABLE. Tipe yang didukung PayrollCalculationService:
        //   fixed, percentage, formula, manual, per_hari (lama)
        //   daily_wage_rate      -> "Upah Per Hari": rate dasar rupiah/hari, base_value diisi manual
        //   attendance_earning   -> "Kehadiran": otomatis = daily_wage_rate x hari hadir aktual
        //   overtime_regular     -> "Lembur Biasa": otomatis = (daily_wage_rate/7) x jam lembur hari efektif
        //   overtime_holiday     -> "Lembur Merah": rate manual x jam lembur hari libur
        //   absence_deduction    -> "Potongan Absen": otomatis = daily_wage_rate x (hari kerja efektif - hari hadir)
        //   early_leave_deduction-> "Potongan Izin Pulang": otomatis dari total menit early_leave
        Schema::create('company_salary_components', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('component_name');
            $table->enum('component_type', ['earning', 'deduction']);
            $table->string('calculation_type', 50);
            $table->decimal('base_value', 15, 2)->nullable();
            $table->string('formula')->nullable(); // ex: "base_salary * 0.02"
            $table->boolean('is_taxable')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
        });

        Schema::create('employee_salary_components', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->uuid('salary_component_id');
            $table->decimal('custom_value', 15, 2)->nullable();
            $table->date('effective_date');
            $table->timestamps();

            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('salary_component_id')->references('id')->on('company_salary_components')->onDelete('cascade');
        });

        Schema::create('payrolls', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->integer('period_month');
            $table->integer('period_year');
            // "Hari Kerja Efektif" bulan ini — diinput manual saat proses payroll karena
            // jumlahnya beda tiap bulan (jumlah hari kerja riil dikurangi libur nasional dsb),
            // dipakai sebagai acuan hitung "Potongan Absen".
            $table->integer('effective_work_days')->nullable();
            $table->enum('status', ['draft', 'processing', 'finalized', 'paid'])->default('draft');
            $table->uuid('generated_by')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->integer('employee_count')->default(0);
            $table->decimal('total_gross', 15, 2)->default(0);
            $table->decimal('total_net', 15, 2)->default(0);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'period_month', 'period_year']);
        });

        Schema::create('payroll_details', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('payroll_id');
            $table->uuid('employee_id');
            $table->integer('total_work_days')->default(0);
            $table->decimal('total_work_hours', 8, 2)->default(0);
            $table->decimal('total_overtime_hours', 8, 2)->default(0);
            $table->json('component_breakdown')->nullable(); // detail per komponen
            $table->decimal('gross_salary', 15, 2)->default(0);
            $table->decimal('total_deduction', 15, 2)->default(0);
            $table->decimal('net_salary', 15, 2)->default(0);
            $table->timestamps();

            $table->foreign('payroll_id')->references('id')->on('payrolls')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->unique(['payroll_id', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_details');
        Schema::dropIfExists('payrolls');
        Schema::dropIfExists('employee_salary_components');
        Schema::dropIfExists('company_salary_components');
        Schema::dropIfExists('company_overtime_rates');
        Schema::dropIfExists('company_work_settings');
    }
};
