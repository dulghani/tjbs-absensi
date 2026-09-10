<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    use HasUuids;

    protected $fillable = ['company_id', 'division_id', 'code', 'name', 'description', 'manager_id', 'status', 'display_order'];

    public function company() { return $this->belongsTo(Company::class); }
    public function division() { return $this->belongsTo(Division::class); }
    public function manager() { return $this->belongsTo(User::class, 'manager_id'); }
    public function sections() { return $this->hasMany(Section::class); }
}
