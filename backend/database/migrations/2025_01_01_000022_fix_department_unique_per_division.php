<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $indexes = collect(DB::select("SHOW INDEX FROM `departments`"))
            ->pluck('Key_name')->unique()->values();

        Schema::table('departments', function (Blueprint $table) use ($indexes) {
            $fks = collect(DB::select("
                SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'departments' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
            "))->pluck('CONSTRAINT_NAME');

            if ($fks->contains('departments_company_id_foreign')) {
                $table->dropForeign('departments_company_id_foreign');
            }

            foreach (['departments_company_id_code_unique', 'departments_code_company_id_unique'] as $idx) {
                if ($indexes->contains($idx)) $table->dropUnique($idx);
            }

            if (! $indexes->contains('departments_company_id_index')) {
                $table->index('company_id', 'departments_company_id_index');
            }

            if (! $indexes->contains('departments_division_id_code_unique')) {
                $table->unique(['division_id', 'code'], 'departments_division_id_code_unique');
            }

            if ($fks->contains('departments_company_id_foreign')) {
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            }
        });
    }

    public function down(): void
    {
        $indexes = collect(DB::select("SHOW INDEX FROM `departments`"))
            ->pluck('Key_name')->unique()->values();
        Schema::table('departments', function (Blueprint $table) use ($indexes) {
            if ($indexes->contains('departments_division_id_code_unique'))
                $table->dropUnique('departments_division_id_code_unique');
            if (! $indexes->contains('departments_company_id_code_unique'))
                $table->unique(['company_id', 'code'], 'departments_company_id_code_unique');
        });
    }
};
