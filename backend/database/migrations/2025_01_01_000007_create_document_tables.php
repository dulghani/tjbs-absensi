<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('code', 50);
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('retention_days')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'code']);
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('category_id');
            $table->string('document_number', 100)->unique();
            $table->string('title');
            $table->text('description')->nullable();

            $table->string('file_path')->nullable();
            $table->integer('file_size')->nullable();
            $table->string('file_mime', 100)->nullable();
            $table->string('file_hash', 128)->nullable();

            $table->date('document_date')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiration_date')->nullable();

            $table->uuid('owned_by_user_id')->nullable();
            $table->json('applicable_to_role')->nullable();
            $table->enum('applicable_to_organization_type', ['company', 'division', 'department', 'section', 'line'])->nullable();
            $table->uuid('applicable_to_organization_id')->nullable();

            $table->boolean('requires_acknowledgment')->default(false);
            $table->uuid('requires_approval_workflow_id')->nullable();
            $table->enum('current_approval_status', ['draft', 'pending_approval', 'approved', 'rejected', 'superseded'])->default('draft');

            $table->integer('version')->default(1);
            $table->boolean('is_current_version')->default(true);
            $table->uuid('parent_document_id')->nullable();
            $table->text('change_summary')->nullable();

            $table->enum('status', ['active', 'archived', 'deleted'])->default('active');
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('category_id')->references('id')->on('document_categories')->onDelete('cascade');
            $table->foreign('requires_approval_workflow_id')->references('id')->on('workflow_definitions')->onDelete('set null');
            $table->index(['company_id', 'category_id']);
        });

        Schema::create('document_acknowledgments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('document_id');
            $table->uuid('employee_id');
            $table->uuid('company_id');
            $table->enum('action', ['read', 'acknowledged', 'signed', 'rejected']);
            $table->timestamp('action_date')->useCurrent();
            $table->enum('action_method', ['digital_signature', 'checkbox', 'manual_sign', 'admin_confirmation'])->nullable();
            $table->text('signature_data')->nullable();
            $table->json('device_info')->nullable();
            $table->uuid('acknowledged_by')->nullable();
            $table->text('notes')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();

            $table->foreign('document_id')->references('id')->on('documents')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['document_id', 'employee_id']);
        });

        Schema::create('document_audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('document_id');
            $table->enum('action_type', ['created', 'viewed', 'modified', 'approved', 'rejected', 'signed', 'archived', 'deleted']);
            $table->uuid('action_by')->nullable();
            $table->timestamp('action_at')->useCurrent();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();

            $table->foreign('document_id')->references('id')->on('documents')->onDelete('cascade');
            $table->index(['document_id', 'action_at']);
        });

        Schema::create('document_distributions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('document_id');
            $table->enum('recipient_type', ['user', 'role', 'organization', 'all_employees']);
            $table->uuid('recipient_user_id')->nullable();
            $table->string('recipient_role', 50)->nullable();
            $table->string('recipient_organization_type', 50)->nullable();
            $table->uuid('recipient_organization_id')->nullable();
            $table->timestamp('distributed_at')->nullable();
            $table->uuid('distributed_by')->nullable();
            $table->date('expiration_date')->nullable();
            $table->enum('status', ['pending', 'received', 'acknowledged', 'rejected'])->default('pending');

            $table->foreign('document_id')->references('id')->on('documents')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_distributions');
        Schema::dropIfExists('document_audit_logs');
        Schema::dropIfExists('document_acknowledgments');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('document_categories');
    }
};
