<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // HEADER - 1 nomor lembur bisa berisi banyak karyawan (lihat overtime_request_details)
        Schema::create('overtime_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('request_number', 50)->unique(); // OT-{company_code}-{YYYYMM}-{seq}
            $table->uuid('company_id');
            $table->string('department')->nullable(); // opsional — satu overtime bisa lintas departemen
            $table->uuid('requested_by'); // -> users.id
            $table->date('overtime_date');
            $table->text('description')->nullable();
            $table->enum('status', ['draft', 'pending', 'approved', 'rejected'])->default('draft');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->index(['company_id', 'status']);
        });

        // DETAIL - multiple karyawan dalam 1 overtime_request (fitur "multiple add")
        Schema::create('overtime_request_details', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('overtime_request_id');
            $table->uuid('employee_id');
            $table->time('plan_start_time');
            $table->time('plan_end_time');
            $table->integer('plan_duration_minutes');
            $table->time('actual_start_time')->nullable();
            $table->time('actual_end_time')->nullable();
            $table->integer('actual_duration_minutes')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('overtime_request_id')->references('id')->on('overtime_requests')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->index('overtime_request_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('overtime_request_details');
        Schema::dropIfExists('overtime_requests');
    }
};
