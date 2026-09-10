<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class EmployeeSalaryComponent extends Model
{
    use HasUuids;
    protected $fillable = ['employee_id', 'salary_component_id', 'custom_value', 'effective_date'];
    protected $casts = ['effective_date' => 'date:Y-m-d'];
}
