<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CompanySalaryComponent extends Model
{
    use HasUuids;
    protected $fillable = ['company_id', 'component_name', 'component_type', 'calculation_type', 'base_value', 'formula', 'is_taxable', 'sort_order'];
    protected $casts = ['is_taxable' => 'boolean'];

    public function company() { return $this->belongsTo(Company::class); }
}
