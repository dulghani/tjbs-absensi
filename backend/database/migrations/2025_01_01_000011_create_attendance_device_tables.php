<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('line_id')->nullable();

            $table->string('brand')->default('fingerspot');
            $table->string('name');
            $table->string('cloud_id')->nullable();
            $table->text('api_key'); // disimpan terenkripsi (Crypt::encryptString)
            $table->string('serial_number')->nullable();
            $table->string('location')->nullable();
            $table->string('timezone')->default('Asia/Jakarta');

            $table->enum('sync_mode', ['scheduled', 'manual'])->default('scheduled');
            $table->unsignedSmallInteger('sync_interval_minutes')->default(15);

            $table->timestamp('last_synced_at')->nullable();
            $table->enum('last_sync_status', ['success', 'failed', 'partial', 'never'])->default('never');
            $table->text('last_sync_error')->nullable();

            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('line_id')->references('id')->on('production_lines')->onDelete('set null');
            $table->index(['company_id', 'status']);
        });

        // PIN di mesin fingerprint adalah ID internal mesin, BUKAN employee_id kita.
        Schema::create('device_employee_mappings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('device_id');
            $table->string('device_pin');
            $table->uuid('employee_id');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('device_id')->references('id')->on('attendance_devices')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->unique(['device_id', 'device_pin']);
            $table->index(['device_id', 'employee_id']);
        });

        Schema::create('attendance_sync_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('device_id');
            $table->date('sync_date');
            $table->enum('status', ['success', 'failed', 'partial', 'running'])->default('running');
            $table->unsignedInteger('records_fetched')->default(0);
            $table->unsignedInteger('records_inserted')->default(0);
            $table->unsignedInteger('records_skipped')->default(0);
            $table->unsignedInteger('records_unmapped')->default(0);
            $table->text('error_message')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->foreign('device_id')->references('id')->on('attendance_devices')->onDelete('cascade');
            $table->index(['device_id', 'sync_date']);
        });

        // Hubungkan attendance_logs ke device asalnya + cegah duplikasi saat sync ulang.
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->uuid('device_id')->nullable()->after('line_id');
            $table->foreign('device_id')->references('id')->on('attendance_devices')->onDelete('set null');
            $table->unique(['employee_id', 'device_id', 'logged_time'], 'uniq_emp_device_time');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->dropUnique('uniq_emp_device_time');
            $table->dropForeign(['device_id']);
            $table->dropColumn('device_id');
        });
        Schema::dropIfExists('attendance_sync_logs');
        Schema::dropIfExists('device_employee_mappings');
        Schema::dropIfExists('attendance_devices');
    }
};
