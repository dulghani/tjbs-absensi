<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class OvertimeRequest extends Model
{
    use HasUuids;

    protected $fillable = ['request_number', 'company_id', 'department', 'requested_by', 'overtime_date', 'description', 'status', 'approved_by', 'approved_at'];
    protected $casts = ['overtime_date' => 'date:Y-m-d', 'approved_at' => 'datetime'];

    public function company() { return $this->belongsTo(Company::class); }
    public function requestedBy() { return $this->belongsTo(User::class, 'requested_by'); }
    public function details() { return $this->hasMany(OvertimeRequestDetail::class); }
}
