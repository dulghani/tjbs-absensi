<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LeaveType extends Model
{
    use HasUuids;

    protected $fillable = ['company_id', 'code', 'name', 'max_days_per_year', 'is_paid', 'color_code', 'status'];
    protected $casts = ['is_paid' => 'boolean'];
}
