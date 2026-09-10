<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AttendanceSummary extends Model
{
    use HasUuids;

    protected $fillable = [
        'employee_id', 'company_id', 'attendance_date', 'assignment_id', 'assigned_shift_id',
        'expected_start_time', 'expected_end_time', 'actual_start_time', 'actual_end_time',
        'attendance_status', 'late_minutes', 'early_leave_minutes', 'expected_work_minutes',
        'actual_work_minutes', 'break_minutes', 'productive_work_minutes', 'overtime_minutes',
        'overtime_verified', 'undertime_minutes', 'shift_type', 'status', 'reviewed_by', 'reviewed_at', 'notes',
    ];
    protected $casts = ['attendance_date' => 'date:Y-m-d', 'reviewed_at' => 'datetime', 'overtime_verified' => 'boolean'];

    public function employee() { return $this->belongsTo(Employee::class); }
}
