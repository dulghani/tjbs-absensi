<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CompanyOvertimeRate extends Model
{
    use HasUuids;
    protected $fillable = ['company_id', 'day_type', 'tier_order', 'hour_from', 'hour_to', 'multiplier', 'fixed_amount'];
}
