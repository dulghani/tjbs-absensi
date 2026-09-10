<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL tidak bisa ALTER ENUM langsung dengan mudah — pakai raw SQL supaya reliable.
        // Tambahkan 'incomplete' ke enum attendance_status di attendance_summaries.
        // 'incomplete' = Kondisi 4 Hybrid: hanya ada 1 scan (gantung), perlu resolusi HRD.
        DB::statement("
            ALTER TABLE attendance_summaries
            MODIFY COLUMN attendance_status
            ENUM('present', 'absent', 'late', 'early_leave', 'on_leave', 'holiday', 'rest_day', 'incomplete')
        ");
    }

    public function down(): void
    {
        // Rollback: hapus 'incomplete' dari enum (pastikan tidak ada data dengan nilai ini dulu).
        DB::statement("
            ALTER TABLE attendance_summaries
            MODIFY COLUMN attendance_status
            ENUM('present', 'absent', 'late', 'early_leave', 'on_leave', 'holiday', 'rest_day')
        ");
    }
};
