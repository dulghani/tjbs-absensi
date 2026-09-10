<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    use HasUuids;

    protected $fillable = [
        'company_id', 'division_id', 'nik', 'ktp_number', 'name', 'gender', 'department', 'line', 'position',
        'employment_status', 'join_date', 'end_date', 'phone', 'address', 'photo_url', 'status',
    ];

    protected $casts = ['join_date' => 'date:Y-m-d', 'end_date' => 'date:Y-m-d'];

    public function company() { return $this->belongsTo(Company::class); }
    public function division() { return $this->belongsTo(\App\Models\Division::class); }
    public function assignments() { return $this->hasMany(EmployeeAssignment::class); }
    public function currentAssignment() { return $this->hasOne(EmployeeAssignment::class)->whereNull('end_date')->where('is_primary', true); }
    public function deviceMappings() { return $this->hasMany(DeviceEmployeeMapping::class); }
    public function attendanceLogs() { return $this->hasMany(AttendanceLog::class); }
    public function attendanceSummaries() { return $this->hasMany(AttendanceSummary::class); }
    public function leaveRequests() { return $this->hasMany(LeaveRequest::class); }
    public function salaryComponents() { return $this->hasMany(EmployeeSalaryComponent::class); }
}
