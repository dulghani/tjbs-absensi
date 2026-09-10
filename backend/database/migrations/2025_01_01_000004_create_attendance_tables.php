<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->uuid('company_id');
            $table->uuid('line_id')->nullable();
            // device_id ditambahkan lewat migration terpisah (2025_07_10_..._fingerspot)
            $table->enum('log_type', ['check_in', 'check_out', 'break_start', 'break_end', 'manual_entry']);
            $table->timestamp('logged_time');
            $table->decimal('logged_lat', 10, 8)->nullable();
            $table->decimal('logged_lng', 11, 8)->nullable();
            $table->string('device_label', 100)->nullable(); // nama bebas kalau bukan dari device terdaftar
            $table->string('biometric_type', 50)->nullable(); // fingerprint, face, rfid, manual
            $table->string('photo_url')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('verified_by')->nullable();
            $table->enum('verification_status', ['auto', 'verified', 'rejected', 'pending'])->default('auto');
            $table->timestamps();

            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('line_id')->references('id')->on('production_lines')->onDelete('set null');
            $table->index(['employee_id', 'logged_time']);
            $table->index('logged_time');
        });

        Schema::create('attendance_summaries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->uuid('company_id');
            $table->date('attendance_date');
            $table->uuid('assignment_id')->nullable();
            $table->uuid('assigned_shift_id')->nullable();
            $table->time('expected_start_time')->nullable();
            $table->time('expected_end_time')->nullable();
            $table->time('actual_start_time')->nullable();
            $table->time('actual_end_time')->nullable();

            $table->enum('attendance_status', ['present', 'absent', 'late', 'early_leave', 'on_leave', 'holiday', 'rest_day']);
            $table->integer('late_minutes')->default(0);
            $table->integer('early_leave_minutes')->default(0);

            $table->integer('expected_work_minutes')->default(0);
            $table->integer('actual_work_minutes')->default(0);
            $table->integer('break_minutes')->default(0);
            $table->integer('productive_work_minutes')->default(0);

            $table->integer('overtime_minutes')->default(0);
            $table->integer('undertime_minutes')->default(0);

            $table->enum('shift_type', ['regular', 'night', 'holiday'])->default('regular');
            $table->enum('status', ['draft', 'auto_finalized', 'manually_reviewed', 'disputed'])->default('draft');
            $table->uuid('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('assigned_shift_id')->references('id')->on('shifts')->onDelete('set null');
            $table->unique(['employee_id', 'attendance_date']);
            $table->index(['employee_id', 'attendance_date']);
        });

        Schema::create('leave_types', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('code', 30);
            $table->string('name');
            $table->integer('max_days_per_year')->nullable();
            $table->boolean('is_paid')->default(true);
            $table->string('color_code', 7)->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'code']);
        });

        Schema::create('leave_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->uuid('company_id');
            $table->uuid('leave_type_id')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->text('reason')->nullable();
            $table->json('attachments')->nullable();
            $table->enum('status', ['draft', 'submitted', 'approved', 'rejected', 'cancelled'])->default('draft');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->boolean('is_paid')->default(true);
            $table->enum('deduction_type', ['salary', 'leave_balance', 'none'])->default('leave_balance');
            $table->timestamps();

            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('leave_type_id')->references('id')->on('leave_types')->onDelete('set null');
            $table->index(['employee_id', 'end_date']);
        });

        Schema::create('attendance_adjustments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('employee_id');
            $table->date('attendance_date');
            $table->enum('adjustment_type', ['add_hours', 'subtract_hours', 'mark_present', 'mark_absent', 'override_status']);
            $table->decimal('hours_amount', 5, 2)->nullable();
            $table->text('reason')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
        });

        Schema::create('attendance_analytics', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->uuid('company_id');
            $table->integer('period_month');
            $table->integer('period_year');
            $table->integer('total_days_in_period')->default(0);
            $table->integer('total_working_days')->default(0);
            $table->integer('days_present')->default(0);
            $table->integer('days_absent')->default(0);
            $table->integer('days_late')->default(0);
            $table->integer('days_early_leave')->default(0);
            $table->integer('days_on_leave')->default(0);
            $table->decimal('total_work_hours', 8, 2)->default(0);
            $table->decimal('total_overtime_hours', 8, 2)->default(0);
            $table->decimal('total_undertime_hours', 8, 2)->default(0);
            $table->decimal('attendance_percentage', 5, 2)->default(0);
            $table->decimal('on_time_percentage', 5, 2)->default(0);
            $table->timestamps();

            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->unique(['employee_id', 'period_month', 'period_year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_analytics');
        Schema::dropIfExists('attendance_adjustments');
        Schema::dropIfExists('leave_requests');
        Schema::dropIfExists('leave_types');
        Schema::dropIfExists('attendance_summaries');
        Schema::dropIfExists('attendance_logs');
    }
};
