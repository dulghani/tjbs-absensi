<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            // true = cuti berbayar (tidak dipotong gaji)
            // false = cuti tidak berbayar (dipotong gaji) — default
            $table->boolean('is_paid')->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropColumn('is_paid');
        });
    }
};
