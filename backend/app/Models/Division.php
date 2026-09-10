<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Division extends Model
{
    use HasUuids;

    protected $fillable = ['company_id', 'code', 'name', 'description', 'parent_division_id', 'status', 'display_order'];

    public function company() { return $this->belongsTo(Company::class); }
    public function departments() { return $this->hasMany(Department::class); }
}
