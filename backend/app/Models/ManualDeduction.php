<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ManualDeduction extends Model
{
    use HasUuids;

    protected $fillable = [
        'company_id', 'employee_id', 'period_month', 'period_year',
        'description', 'type', 'amount', 'status', 'notes', 'created_by',
    ];

    protected $casts = ['amount' => 'decimal:2'];

    public function employee() { return $this->belongsTo(Employee::class); }
    public function company()  { return $this->belongsTo(Company::class); }
    public function creator()  { return $this->belongsTo(User::class, 'created_by'); }
}
