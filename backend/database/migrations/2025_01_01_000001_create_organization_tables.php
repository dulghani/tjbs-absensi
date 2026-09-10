<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 20)->unique();
            $table->string('name');
            $table->string('npwp', 30)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->string('pic_name')->nullable();
            $table->string('pic_phone', 30)->nullable();
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->timestamps();
        });

        Schema::create('divisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('code', 30);
            $table->string('name');
            $table->text('description')->nullable();
            $table->uuid('parent_division_id')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->integer('display_order')->default(0);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'code']);
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('division_id')->nullable();
            $table->string('code', 30);
            $table->string('name');
            $table->text('description')->nullable();
            $table->uuid('manager_id')->nullable(); // -> users.id
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->integer('display_order')->default(0);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('division_id')->references('id')->on('divisions')->onDelete('set null');
            // Unique per DIVISI (bukan per company) — boleh kode sama asal beda divisi
            // Contoh: "ITE" boleh ada di divisi WIN ITE sekaligus di PT. Istana Tiara
            $table->unique(['division_id', 'code'], 'dept_division_code_unique');
        });

        Schema::create('sections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('department_id');
            $table->uuid('company_id'); // denormalized untuk query cepat
            $table->string('code', 30);
            $table->string('name');
            $table->text('description')->nullable();
            $table->uuid('manager_id')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->integer('display_order')->default(0);
            $table->timestamps();

            $table->foreign('department_id')->references('id')->on('departments')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['department_id', 'code']);
        });

        Schema::create('production_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('section_id');
            $table->uuid('department_id');
            $table->uuid('company_id');
            $table->string('code', 30);
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('capacity')->nullable();
            $table->uuid('manager_id')->nullable();
            $table->string('location')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->integer('display_order')->default(0);
            $table->timestamps();

            $table->foreign('section_id')->references('id')->on('sections')->onDelete('cascade');
            $table->foreign('department_id')->references('id')->on('departments')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['section_id', 'code']);
        });

        Schema::create('cost_centers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('code', 30);
            $table->string('name');
            $table->text('description')->nullable();
            $table->uuid('parent_cost_center_id')->nullable();
            $table->decimal('budget_limit', 15, 2)->nullable();
            $table->uuid('manager_id')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'code']);
        });

        Schema::create('org_attributes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->enum('organization_type', ['company', 'division', 'department', 'section', 'line']);
            $table->uuid('organization_id');
            $table->string('attribute_key', 100);
            $table->text('attribute_value')->nullable();
            $table->timestamps();

            $table->index(['organization_type', 'organization_id']);
            $table->unique(['organization_type', 'organization_id', 'attribute_key'], 'uniq_org_attr');
        });

        // FK users.company_id ditambahkan di sini karena tabel companies baru saja dibuat.
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->dropForeign(['company_id']));
        Schema::dropIfExists('org_attributes');
        Schema::dropIfExists('cost_centers');
        Schema::dropIfExists('production_lines');
        Schema::dropIfExists('sections');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('divisions');
        Schema::dropIfExists('companies');
    }
};
