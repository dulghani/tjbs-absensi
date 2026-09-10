<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DeviceEmployeeMapping extends Model
{
    use HasUuids;
    protected $fillable = ['device_id', 'device_pin', 'employee_id', 'status'];

    public function device() { return $this->belongsTo(AttendanceDevice::class, 'device_id'); }
    public function employee() { return $this->belongsTo(Employee::class); }
}
