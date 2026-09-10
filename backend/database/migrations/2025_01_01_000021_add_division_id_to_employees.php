<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Safety net: tambahkan division_id ke employees kalau belum ada.
 * Kolom ini sudah ada di migration 000002 (fresh install tidak perlu ini).
 * Migration ini hanya berlaku untuk database yang sudah jalan sebelum 000002 diupdate.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('employees', 'division_id')) {
            Schema::table('employees', function (Blueprint $table) {
                $table->uuid('division_id')->nullable()->after('company_id');
                $table->foreign('division_id')->references('id')->on('divisions')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('employees', 'division_id')) {
            Schema::table('employees', function (Blueprint $table) {
                $table->dropForeign(['division_id']);
                $table->dropColumn('division_id');
            });
        }
    }
};
