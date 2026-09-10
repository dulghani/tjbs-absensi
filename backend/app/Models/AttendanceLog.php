<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AttendanceLog extends Model
{
    use HasUuids;

    protected $fillable = [
        'employee_id', 'company_id', 'line_id', 'device_id', 'log_type', 'logged_time',
        'logged_lat', 'logged_lng', 'device_label', 'biometric_type', 'photo_url', 'notes',
        'verified_by', 'verification_status',
    ];
    protected $casts = ['logged_time' => 'datetime'];

    public function employee() { return $this->belongsTo(Employee::class); }
    public function device() { return $this->belongsTo(AttendanceDevice::class); }
}
