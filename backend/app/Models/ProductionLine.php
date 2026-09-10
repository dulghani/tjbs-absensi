<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ProductionLine extends Model
{
    use HasUuids;

    protected $table = 'production_lines';

    protected $fillable = ['section_id', 'department_id', 'company_id', 'code', 'name', 'description', 'capacity', 'manager_id', 'location', 'status', 'display_order'];

    public function section() { return $this->belongsTo(Section::class, 'section_id'); }
    public function department() { return $this->belongsTo(Department::class); }
    public function company() { return $this->belongsTo(Company::class); }
}
