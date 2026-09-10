<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('code', 50);
            $table->string('name');
            $table->enum('category', ['workflow', 'system', 'reminder', 'alert'])->default('system');
            $table->text('subject_template')->nullable();
            $table->text('body_template')->nullable();
            $table->json('variables')->nullable();
            $table->boolean('send_via_email')->default(true);
            $table->boolean('send_via_sms')->default(false);
            $table->boolean('send_via_in_app')->default(true);
            $table->boolean('send_via_slack')->default(false);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'code']);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('recipient_user_id');
            $table->uuid('notification_template_id')->nullable();
            $table->string('title');
            $table->text('body')->nullable();
            $table->json('payload')->nullable();
            $table->string('related_entity_type', 100)->nullable();
            $table->uuid('related_entity_id')->nullable();
            $table->string('action_url')->nullable();
            $table->enum('status', ['pending', 'sent', 'read', 'archived'])->default('pending');
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->boolean('email_sent')->default(false);
            $table->boolean('sms_sent')->default(false);
            $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('recipient_user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('notification_template_id')->references('id')->on('notification_templates')->onDelete('set null');
            $table->index(['recipient_user_id', 'status']);
        });

        Schema::create('approval_center_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('approver_user_id');
            $table->uuid('workflow_instance_id')->nullable();
            $table->uuid('current_step_id')->nullable();
            $table->string('item_type', 50);
            $table->string('item_id', 100);
            $table->string('requestor_name')->nullable();
            $table->string('requestor_department')->nullable();
            $table->timestamp('request_date')->nullable();
            $table->text('brief_info')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->integer('days_pending')->default(0);
            $table->integer('escalation_level')->default(0);
            $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal');
            $table->timestamp('deadline_at')->nullable();
            $table->boolean('is_overdue')->default(false);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('approver_user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('workflow_instance_id')->references('id')->on('workflow_instances')->onDelete('cascade');
            $table->index(['approver_user_id', 'status']);
        });

        Schema::create('notification_delivery_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('notification_id');
            $table->enum('delivery_channel', ['email', 'sms', 'in_app', 'slack', 'webhook']);
            $table->string('recipient_address')->nullable();
            $table->enum('status', ['pending', 'processing', 'delivered', 'failed', 'bounced'])->default('pending');
            $table->timestamp('delivery_time')->nullable();
            $table->text('error_message')->nullable();
            $table->integer('retry_count')->default(0);
            $table->integer('max_retries')->default(3);
            $table->string('external_reference_id')->nullable();
            $table->timestamps();

            $table->foreign('notification_id')->references('id')->on('notifications')->onDelete('cascade');
            $table->index(['status', 'delivery_channel']);
        });

        Schema::create('user_notification_preferences', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('company_id');
            $table->uuid('notification_template_id')->nullable();
            $table->boolean('enabled')->default(true);
            $table->boolean('email_enabled')->default(true);
            $table->boolean('sms_enabled')->default(false);
            $table->boolean('in_app_enabled')->default(true);
            $table->time('quiet_hours_start')->nullable();
            $table->time('quiet_hours_end')->nullable();
            $table->boolean('quiet_hours_enabled')->default(false);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('notification_template_id')->references('id')->on('notification_templates')->onDelete('cascade');
            $table->unique(['user_id', 'company_id', 'notification_template_id'], 'uniq_user_notif_pref');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notification_preferences');
        Schema::dropIfExists('notification_delivery_logs');
        Schema::dropIfExists('approval_center_items');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('notification_templates');
    }
};
