<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class EmployeeAssignment extends Model
{
    use HasUuids;

    protected $fillable = [
        'employee_id', 'company_id', 'division_id', 'department_id', 'section_id', 'line_id',
        'cost_center_id', 'position_code', 'job_title', 'salary_grade', 'assignment_date',
        'end_date', 'is_primary', 'status',
    ];

    protected $casts = ['assignment_date' => 'date:Y-m-d', 'end_date' => 'date:Y-m-d', 'is_primary' => 'boolean'];

    public function employee() { return $this->belongsTo(Employee::class); }
    public function company() { return $this->belongsTo(Company::class); }
    public function department() { return $this->belongsTo(Department::class); }
    public function section() { return $this->belongsTo(Section::class); }
    public function line() { return $this->belongsTo(ProductionLine::class, 'line_id'); }
}
