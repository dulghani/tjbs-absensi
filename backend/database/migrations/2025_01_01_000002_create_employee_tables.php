<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('division_id')->nullable(); // divisi tempat karyawan ditempatkan
            $table->string('nik', 30)->nullable(); // kode internal, TIDAK dijamin unik (lihat catatan import Fingerspot)
            $table->string('ktp_number', 20)->nullable(); // NIK KTP asli, beda dari kolom 'nik' di atas
            $table->string('name');
            $table->enum('gender', ['L', 'P'])->nullable();
            $table->string('department')->nullable(); // nama bebas, dipakai saat belum di-assign ke struktur formal
            $table->string('line')->nullable();
            $table->string('position')->nullable();
            $table->enum('employment_status', ['probation', 'permanent', 'contract', 'temporary'])->default('permanent');
            $table->date('join_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('phone', 30)->nullable();
            $table->text('address')->nullable();
            $table->string('photo_url')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('division_id')->references('id')->on('divisions')->onDelete('set null');
            $table->index(['company_id', 'status']);
        });

        // Riwayat lengkap penempatan karyawan (dept/section/line berubah dari waktu ke waktu).
        Schema::create('employee_assignments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->uuid('company_id');
            $table->uuid('division_id')->nullable();
            $table->uuid('department_id');
            $table->uuid('section_id')->nullable();
            $table->uuid('line_id')->nullable();
            $table->uuid('cost_center_id')->nullable();
            $table->string('position_code', 50)->nullable();
            $table->string('job_title')->nullable();
            $table->string('salary_grade', 20)->nullable();
            $table->date('assignment_date');
            $table->date('end_date')->nullable(); // NULL = assignment aktif saat ini
            $table->boolean('is_primary')->default(true);
            $table->enum('status', ['active', 'suspended', 'terminated'])->default('active');
            $table->timestamps();

            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('division_id')->references('id')->on('divisions')->onDelete('set null');
            $table->foreign('department_id')->references('id')->on('departments')->onDelete('cascade');
            $table->foreign('section_id')->references('id')->on('sections')->onDelete('set null');
            $table->foreign('line_id')->references('id')->on('production_lines')->onDelete('set null');
            $table->foreign('cost_center_id')->references('id')->on('cost_centers')->onDelete('set null');
            $table->index(['employee_id', 'end_date']);
            $table->index(['department_id', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_assignments');
        Schema::dropIfExists('employees');
    }
};
