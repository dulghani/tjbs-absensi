<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CompanyEffectiveWorkDays extends Model
{
    use HasUuids;

    protected $table = 'company_effective_work_days';
    protected $fillable = ['company_id', 'period_month', 'period_year', 'effective_days'];
}
