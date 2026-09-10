<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ShiftPattern extends Model
{
    use HasUuids;

    protected $fillable = ['company_id', 'code', 'name', 'description', 'pattern_length', 'status'];

    public function company() { return $this->belongsTo(Company::class); }
    public function details() { return $this->hasMany(ShiftPatternDetail::class, 'pattern_id')->orderBy('day_number'); }
}
