<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CostCenter extends Model
{
    use HasUuids;

    protected $fillable = ['company_id', 'code', 'name', 'description', 'parent_cost_center_id', 'budget_limit', 'manager_id', 'status'];

    public function company() { return $this->belongsTo(Company::class); }
}
