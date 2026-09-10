<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('leave_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->cascadeOnDelete();
            // Tipe izin
            $table->enum('leave_type', ['not_present','late','early_leave']);
            $table->date('leave_date');
            // Untuk terlambat: jam masuk aktual, jam normal diabaikan
            $table->time('actual_time')->nullable();  // jam masuk aktual (terlambat) / jam pulang (pulang cepat)
            $table->string('reason', 500);            // alasan izin
            $table->string('status', 20)->default('pending'); // pending/approved/rejected
            $table->text('notes')->nullable();        // catatan approver
            $table->foreignUuid('submitted_by')->nullable()->constrained('users'); // HRD yang input
            $table->foreignUuid('approved_by')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'leave_date']);
            $table->index(['employee_id', 'leave_date']);
        });
    }
    public function down(): void { Schema::dropIfExists('leave_requests'); }
};
