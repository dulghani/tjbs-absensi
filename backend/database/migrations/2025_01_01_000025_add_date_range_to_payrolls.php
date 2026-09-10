<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tambah kolom baru — pakai hasColumn supaya aman kalau migration pernah gagal di tengah
        Schema::table('payrolls', function (Blueprint $table) {
            if (! Schema::hasColumn('payrolls', 'date_from'))
                $table->date('date_from')->nullable()->after('period_year');
            if (! Schema::hasColumn('payrolls', 'date_to'))
                $table->date('date_to')->nullable()->after('date_from');
            if (! Schema::hasColumn('payrolls', 'division_id'))
                $table->uuid('division_id')->nullable()->after('date_to');
            if (! Schema::hasColumn('payrolls', 'department'))
                $table->string('department', 255)->nullable()->after('division_id');
            if (! Schema::hasColumn('payrolls', 'scope_label'))
                $table->string('scope_label', 100)->nullable()->after('department');
        });

        // Pastikan backing index ada sebelum drop unique lama
        $indexes = collect(\DB::select("SHOW INDEX FROM payrolls"))->pluck('Key_name');

        if (! $indexes->contains('payrolls_company_id_idx')) {
            Schema::table('payrolls', function (Blueprint $table) {
                $table->index('company_id', 'payrolls_company_id_idx');
            });
        }

        if ($indexes->contains('payrolls_company_id_period_month_period_year_unique')) {
            Schema::table('payrolls', function (Blueprint $table) {
                $table->dropUnique('payrolls_company_id_period_month_period_year_unique');
            });
        }

        $indexes2 = collect(\DB::select("SHOW INDEX FROM payrolls"))->pluck('Key_name');
        if (! $indexes2->contains('payrolls_scope_unique')) {
            Schema::table('payrolls', function (Blueprint $table) {
                $table->unique(
                    ['company_id', 'period_month', 'period_year', 'division_id', 'department'],
                    'payrolls_scope_unique'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropUnique('payrolls_scope_unique');
            // Buat backing index dulu sebelum re-add unique lama
            $table->index('company_id', 'payrolls_company_id_idx_tmp');
        });

        Schema::table('payrolls', function (Blueprint $table) {
            $table->unique(['company_id', 'period_month', 'period_year']);
            $table->dropIndex('payrolls_company_id_idx');
            $table->dropIndex('payrolls_company_id_idx_tmp');
            $table->dropColumn(['date_from', 'date_to', 'division_id', 'department', 'scope_label']);
        });
    }
};
