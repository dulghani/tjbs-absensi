<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class OvertimeRequestDetail extends Model
{
    use HasUuids;

    protected $table = 'overtime_request_details';

    protected $fillable = [
        'overtime_request_id', 'employee_id', 'plan_start_time', 'plan_end_time', 'plan_duration_minutes',
        'actual_start_time', 'actual_end_time', 'actual_duration_minutes', 'status', 'notes',
    ];

    public function overtimeRequest() { return $this->belongsTo(OvertimeRequest::class); }
    public function employee() { return $this->belongsTo(Employee::class); }

    /**
     * Attendance summary untuk karyawan ini pada tanggal lembur.
     * Digunakan untuk menampilkan jam pulang aktual & status lembur aktual.
     */
    public function attendanceSummary()
    {
        return $this->hasOne(AttendanceSummary::class, 'employee_id', 'employee_id')
            ->whereColumn('attendance_date', $this->overtimeRequest()->getRelated()->getTable() . '.overtime_date')
            ->orWhereHas('overtimeRequest', fn ($q) => $q->whereColumn(
                'attendance_summaries.attendance_date', 'overtime_requests.overtime_date'
            ));
    }
}
