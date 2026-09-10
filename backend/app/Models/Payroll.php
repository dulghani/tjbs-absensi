<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Payroll extends Model
{
    use HasUuids;
    protected $fillable = [
        'company_id', 'period_month', 'period_year',
        'date_from', 'date_to',
        'division_id', 'department', 'scope_label',
        'effective_work_days', 'status',
        'generated_by', 'generated_at', 'finalized_at',
        'employee_count', 'total_gross', 'total_net',
    ];
    protected $casts = [
        'generated_at' => 'datetime',
        'finalized_at' => 'datetime',
        'date_from'    => 'date:Y-m-d',
        'date_to'      => 'date:Y-m-d',
    ];

    public function company() { return $this->belongsTo(Company::class); }
    public function details() { return $this->hasMany(PayrollDetail::class); }
}
