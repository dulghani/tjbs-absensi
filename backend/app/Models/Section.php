<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Section extends Model
{
    use HasUuids;

    protected $fillable = ['department_id', 'company_id', 'code', 'name', 'description', 'manager_id', 'status', 'display_order'];

    public function department() { return $this->belongsTo(Department::class); }
    public function company() { return $this->belongsTo(Company::class); }
    public function lines() { return $this->hasMany(ProductionLine::class, 'section_id'); }
}
