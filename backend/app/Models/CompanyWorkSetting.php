<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CompanyWorkSetting extends Model
{
    use HasUuids;
    protected $fillable = ['company_id', 'work_start_time', 'work_end_time', 'break_duration_minutes', 'work_days', 'daily_hours_override', 'business_date_cutoff', 'overtime_min_minutes', 'overtime_calc_method', 'late_tolerance_minutes', 'early_leave_tolerance_minutes', 'effective_date', 'created_by'];
    protected $casts = ['work_days' => 'array', 'daily_hours_override' => 'array', 'effective_date' => 'date:Y-m-d'];

    public function company() { return $this->belongsTo(Company::class); }
}
