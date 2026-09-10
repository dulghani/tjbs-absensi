<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shifts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('code', 30);
            $table->string('name');
            $table->text('description')->nullable();
            $table->time('start_time');
            $table->time('end_time');
            $table->integer('break_duration_minutes')->default(60);
            $table->integer('total_work_minutes')->default(0);
            $table->boolean('is_night_shift')->default(false);
            $table->string('color_code', 7)->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'code']);
        });

        Schema::create('shift_patterns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('code', 30);
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('pattern_length'); // jumlah hari dalam 1 siklus
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'code']);
        });

        Schema::create('shift_pattern_details', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('pattern_id');
            $table->integer('day_number'); // hari ke-N dalam siklus
            $table->uuid('shift_id')->nullable(); // NULL = hari libur dalam siklus
            $table->text('notes')->nullable();

            $table->foreign('pattern_id')->references('id')->on('shift_patterns')->onDelete('cascade');
            $table->foreign('shift_id')->references('id')->on('shifts')->onDelete('cascade');
            $table->unique(['pattern_id', 'day_number']);
        });

        Schema::create('employee_shifts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->uuid('company_id');
            $table->uuid('shift_id')->nullable();
            $table->uuid('shift_pattern_id')->nullable();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->enum('assignment_type', ['fixed', 'rotating', 'flexible'])->default('fixed');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('shift_id')->references('id')->on('shifts')->onDelete('set null');
            $table->foreign('shift_pattern_id')->references('id')->on('shift_patterns')->onDelete('set null');
            $table->index(['employee_id', 'end_date']);
        });

        Schema::create('shift_swaps', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('requestor_id');
            $table->uuid('requestor_assignment_id');
            $table->uuid('assignee_id');
            $table->uuid('assignee_assignment_id');
            $table->date('swap_date');
            $table->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])->default('pending');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('requestor_id')->references('id')->on('employees');
            $table->foreign('assignee_id')->references('id')->on('employees');
            $table->foreign('requestor_assignment_id')->references('id')->on('employee_shifts');
            $table->foreign('assignee_assignment_id')->references('id')->on('employee_shifts');
        });

        // ── Kalender perusahaan ──────────────────────────────────────────────
        Schema::create('company_calendars', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->integer('calendar_year');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'calendar_year']);
        });

        Schema::create('calendar_dates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('calendar_id');
            $table->date('date');
            $table->enum('day_type', ['working', 'holiday', 'special_working', 'special_off', 'company_event']);
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_paid')->default(false);
            $table->decimal('work_multiplier', 2, 1)->default(1.0);
            $table->timestamps();

            $table->foreign('calendar_id')->references('id')->on('company_calendars')->onDelete('cascade');
            $table->unique(['calendar_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_dates');
        Schema::dropIfExists('company_calendars');
        Schema::dropIfExists('shift_swaps');
        Schema::dropIfExists('employee_shifts');
        Schema::dropIfExists('shift_pattern_details');
        Schema::dropIfExists('shift_patterns');
        Schema::dropIfExists('shifts');
    }
};
