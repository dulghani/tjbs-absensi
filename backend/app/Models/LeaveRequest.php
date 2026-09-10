<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LeaveRequest extends Model
{
    use HasUuids;

    protected $fillable = [
        'company_id','employee_id','leave_type','leave_date',
        'actual_time','reason','status','notes',
        'submitted_by','approved_by','approved_at',
    ];

    protected $casts = [
        'leave_date'  => 'date',
        'approved_at' => 'datetime',
    ];

    public function employee()    { return $this->belongsTo(Employee::class); }
    public function company()     { return $this->belongsTo(Company::class); }
    public function submittedBy() { return $this->belongsTo(User::class, 'submitted_by'); }
    public function approvedBy()  { return $this->belongsTo(User::class, 'approved_by'); }
}
