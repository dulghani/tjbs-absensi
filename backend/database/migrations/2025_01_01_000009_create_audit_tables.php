<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            // Nullable: user coordinator/field_officer TIDAK terikat 1 perusahaan
            // (company_id mereka null by design), jadi aksi mereka (mis. bikin
            // perusahaan baru) tidak selalu punya "perusahaan pemilik" yang jelas.
            $table->uuid('company_id')->nullable();
            $table->uuid('user_id');
            $table->enum('action_category', ['create', 'read', 'update', 'delete', 'approve', 'reject', 'export', 'import', 'workflow', 'calculation']);
            $table->string('entity_type', 100);
            $table->string('entity_id', 100)->nullable();
            $table->string('entity_name')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->text('changes_summary')->nullable();
            $table->string('source_ip', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('request_id', 100)->nullable();
            $table->string('api_endpoint')->nullable();
            $table->boolean('contains_sensitive_data')->default(false);
            $table->string('masked_reason')->nullable();
            $table->enum('status', ['success', 'failure', 'partial'])->default('success');
            $table->text('error_message')->nullable();
            $table->boolean('is_legal_hold')->default(false);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['entity_type', 'entity_id']);
            $table->index(['user_id', 'created_at']);
            $table->index('created_at');
            $table->index('contains_sensitive_data');
        });

        Schema::create('audit_events', function (Blueprint $table) {
            $table->id(); // bigint auto-increment, dipakai sebagai global sequence
            $table->uuid('audit_log_id')->nullable();
            $table->string('event_type', 100);
            $table->timestamp('event_timestamp')->useCurrent();
            $table->bigInteger('event_sequence')->nullable();
            $table->string('processed_by_system', 100)->nullable();

            $table->foreign('audit_log_id')->references('id')->on('audit_logs')->onDelete('cascade');
            $table->index('event_timestamp');
            $table->index('event_type');
        });

        Schema::create('audit_retention_policies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('entity_type', 100);
            $table->integer('retention_days');
            $table->string('action_category', 100)->default('all');
            $table->boolean('auto_delete')->default(false);
            $table->boolean('auto_archive')->default(true);
            $table->string('archive_location')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
        });

        Schema::create('audit_data_access_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('user_id');
            $table->string('table_name', 100);
            $table->json('column_names')->nullable();
            $table->json('record_ids')->nullable();
            $table->enum('query_type', ['sql', 'api', 'export', 'report']);
            $table->text('query_summary')->nullable();
            $table->enum('access_method', ['web_ui', 'api', 'batch_job', 'report_generator']);
            $table->timestamp('access_time')->useCurrent();
            $table->string('source_ip', 45)->nullable();
            $table->boolean('contains_pii')->default(false);
            $table->boolean('contains_salary')->default(false);
            $table->enum('status', ['allowed', 'denied', 'flagged_for_review'])->default('allowed');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['contains_pii', 'contains_salary']);
        });

        Schema::create('audit_anomalies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->enum('anomaly_type', ['unusual_time', 'multiple_failed_logins', 'data_export_spike', 'salary_change_outlier', 'access_outside_role']);
            $table->string('entity_type', 100)->nullable();
            $table->string('entity_id', 100)->nullable();
            $table->text('description')->nullable();
            $table->enum('severity', ['low', 'medium', 'high', 'critical'])->default('low');
            $table->timestamp('flagged_at')->useCurrent();
            $table->uuid('flagged_by')->nullable();
            $table->uuid('investigated_by')->nullable();
            $table->text('investigation_notes')->nullable();
            $table->enum('status', ['flagged', 'investigating', 'resolved', 'false_positive'])->default('flagged');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('flagged_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('investigated_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_anomalies');
        Schema::dropIfExists('audit_data_access_logs');
        Schema::dropIfExists('audit_retention_policies');
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('audit_logs');
    }
};
