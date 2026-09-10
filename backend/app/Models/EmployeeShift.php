<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class EmployeeShift extends Model
{
    use HasUuids;

    protected $fillable = ['employee_id', 'company_id', 'shift_id', 'shift_pattern_id', 'start_date', 'end_date', 'assignment_type', 'status'];
    protected $casts = ['start_date' => 'date:Y-m-d', 'end_date' => 'date:Y-m-d'];

    public function employee() { return $this->belongsTo(Employee::class); }
    public function shift() { return $this->belongsTo(Shift::class); }
    public function pattern() { return $this->belongsTo(ShiftPattern::class, 'shift_pattern_id'); }
}
