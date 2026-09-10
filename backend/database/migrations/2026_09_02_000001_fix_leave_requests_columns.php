<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $cols = collect(DB::select("SHOW COLUMNS FROM `leave_requests`"))->pluck('Field')->toArray();

        // Ambil semua foreign key yang ada di tabel ini
        $fks = collect(DB::select("
            SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'leave_requests'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        "))->pluck('CONSTRAINT_NAME')->toArray();

        // Step 1 — Drop FK leave_type_id dulu sebelum drop kolom
        Schema::table('leave_requests', function (Blueprint $table) use ($fks) {
            if (in_array('leave_requests_leave_type_id_foreign', $fks)) {
                $table->dropForeign('leave_requests_leave_type_id_foreign');
            }
            // Drop FK lain yang mungkin menghambat
            foreach (['leave_requests_end_date_foreign','leave_requests_attachments_foreign',
                      'leave_requests_is_paid_foreign','leave_requests_deduction_type_foreign'] as $fk) {
                if (in_array($fk, $fks)) $table->dropForeign($fk);
            }
        });

        // Step 2 — Tambah kolom baru yang dibutuhkan
        Schema::table('leave_requests', function (Blueprint $table) use ($cols) {
            if (! in_array('leave_type', $cols)) {
                $table->string('leave_type', 30)->default('not_present')->after('company_id');
            }
            if (in_array('start_date', $cols) && ! in_array('leave_date', $cols)) {
                $table->renameColumn('start_date', 'leave_date');
            }
            if (! in_array('actual_time', $cols)) {
                $table->time('actual_time')->nullable()->after('leave_date');
            }
            if (! in_array('notes', $cols)) {
                $table->text('notes')->nullable()->after('reason');
            }
            if (! in_array('submitted_by', $cols)) {
                $table->uuid('submitted_by')->nullable()->after('notes');
            }
        });

        // Step 3 — Drop kolom yang tidak dipakai (setelah FK dilepas)
        Schema::table('leave_requests', function (Blueprint $table) use ($cols) {
            $toDrop = array_values(array_intersect(
                ['end_date', 'attachments', 'is_paid', 'deduction_type', 'leave_type_id'],
                $cols
            ));
            if ($toDrop) $table->dropColumn($toDrop);
        });
    }

    public function down(): void {}
};
