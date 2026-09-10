<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PayrollDetail extends Model
{
    use HasUuids;
    protected $fillable = ['payroll_id', 'employee_id', 'total_work_days', 'total_work_hours', 'total_overtime_hours', 'component_breakdown', 'gross_salary', 'total_deduction', 'net_salary'];
    protected $casts = ['component_breakdown' => 'array'];

    public function payroll() { return $this->belongsTo(Payroll::class); }
    public function employee() { return $this->belongsTo(Employee::class); }
}
