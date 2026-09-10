<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_definitions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('code', 50);
            $table->string('name');
            $table->string('entity_type', 100); // 'overtime_request', 'leave_request', 'document'
            $table->text('description')->nullable();
            $table->string('initial_status', 50)->default('submitted');
            $table->string('final_status', 50)->default('approved');
            $table->string('rejection_status', 50)->default('rejected');
            $table->json('trigger_conditions')->nullable();
            $table->json('auto_approve_conditions')->nullable();
            $table->enum('status', ['active', 'inactive', 'archived'])->default('active');
            $table->integer('version')->default(1);
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'code']);
        });

        Schema::create('workflow_steps', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workflow_id');
            $table->integer('step_order');
            $table->string('step_code', 50);
            $table->string('step_name');
            $table->text('description')->nullable();
            $table->enum('approval_type', ['single', 'multiple', 'any', 'all'])->default('single');
            $table->enum('approver_selection', ['role', 'user', 'position', 'manager', 'custom_rule'])->default('role');
            $table->json('approvers_json')->nullable();
            $table->boolean('can_reject')->default(true);
            $table->boolean('can_revise')->default(false);
            $table->boolean('parallel_execution')->default(false);
            $table->integer('step_timeout_hours')->nullable();
            $table->enum('default_action', ['approve', 'reject', 'hold', 'pass'])->default('hold');
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('workflow_id')->references('id')->on('workflow_definitions')->onDelete('cascade');
            $table->unique(['workflow_id', 'step_order']);
        });

        Schema::create('workflow_step_approvers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('step_id');
            $table->uuid('approver_user_id')->nullable();
            $table->string('approver_role', 50)->nullable();
            $table->string('approver_position', 50)->nullable();
            $table->json('custom_rule_json')->nullable();
            $table->integer('order_priority')->default(0);
            $table->boolean('is_optional')->default(false);

            $table->foreign('step_id')->references('id')->on('workflow_steps')->onDelete('cascade');
        });

        Schema::create('workflow_instances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('workflow_definition_id');
            $table->string('entity_type', 100);
            $table->uuid('entity_id'); // referensi ke PK tabel terkait (overtime_requests.id, dll)
            $table->uuid('current_step_id')->nullable();
            $table->string('current_status', 50)->default('submitted');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->uuid('created_by')->nullable();
            $table->string('final_decision', 50)->nullable();
            $table->uuid('final_decision_by')->nullable();
            $table->timestamp('final_decision_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->integer('revision_count')->default(0);
            $table->json('context_data')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('workflow_definition_id')->references('id')->on('workflow_definitions')->onDelete('cascade');
            $table->foreign('current_step_id')->references('id')->on('workflow_steps')->onDelete('set null');
            $table->index(['entity_type', 'entity_id']);
            $table->index(['company_id', 'current_status']);
        });

        Schema::create('workflow_approvals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workflow_instance_id');
            $table->uuid('step_id');
            $table->uuid('approver_user_id')->nullable();
            $table->enum('action', ['approved', 'rejected', 'revised', 'hold', 'escalated']);
            $table->text('reason')->nullable();
            $table->text('comments')->nullable();
            $table->json('attachments')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->integer('approval_time_minutes')->nullable();

            $table->foreign('workflow_instance_id')->references('id')->on('workflow_instances')->onDelete('cascade');
            $table->foreign('step_id')->references('id')->on('workflow_steps')->onDelete('cascade');
            $table->index(['workflow_instance_id', 'step_id']);
        });

        Schema::create('workflow_transitions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workflow_instance_id');
            $table->uuid('from_step_id')->nullable();
            $table->uuid('to_step_id')->nullable();
            $table->enum('transition_type', ['forward', 'backward', 'skip', 'escalate', 'auto']);
            $table->text('reason')->nullable();
            $table->uuid('triggered_by')->nullable();
            $table->timestamp('triggered_at')->useCurrent();
            $table->boolean('condition_met')->nullable();
            $table->json('condition_details')->nullable();

            $table->foreign('workflow_instance_id')->references('id')->on('workflow_instances')->onDelete('cascade');
            $table->foreign('from_step_id')->references('id')->on('workflow_steps')->onDelete('set null');
            $table->foreign('to_step_id')->references('id')->on('workflow_steps')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_transitions');
        Schema::dropIfExists('workflow_approvals');
        Schema::dropIfExists('workflow_instances');
        Schema::dropIfExists('workflow_step_approvers');
        Schema::dropIfExists('workflow_steps');
        Schema::dropIfExists('workflow_definitions');
    }
};
