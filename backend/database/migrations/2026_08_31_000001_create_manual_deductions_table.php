<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('manual_deductions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->unsignedTinyInteger('period_month'); // bulan berlaku
            $table->unsignedSmallInteger('period_year');
            $table->string('description', 255);          // keterangan potongan
            $table->string('type', 50)->default('other');// kasbon, cicilan, denda, dll
            $table->decimal('amount', 15, 2);            // nominal potongan
            $table->string('status', 20)->default('active'); // active / cancelled
            $table->text('notes')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users');
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('manual_deductions'); }
};
