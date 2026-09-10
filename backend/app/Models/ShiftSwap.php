<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ShiftSwap extends Model
{
    use HasUuids;

    protected $fillable = ['company_id', 'requestor_id', 'requestor_assignment_id', 'assignee_id', 'assignee_assignment_id', 'swap_date', 'status', 'approved_by', 'approved_at', 'reason'];
    protected $casts = ['swap_date' => 'date:Y-m-d', 'approved_at' => 'datetime'];

    public function requestor() { return $this->belongsTo(Employee::class, 'requestor_id'); }
    public function assignee() { return $this->belongsTo(Employee::class, 'assignee_id'); }
}
