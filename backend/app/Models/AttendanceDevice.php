<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Crypt;

class AttendanceDevice extends Model
{
    use HasUuids;

    protected $fillable = [
        'company_id', 'line_id', 'division_id', 'brand', 'name', 'cloud_id', 'api_key',
        'serial_number', 'location', 'timezone', 'sync_mode', 'sync_interval_minutes',
        'default_position', 'default_employment_status',
        'last_synced_at', 'last_sync_status', 'last_sync_error', 'status',
    ];

    protected $hidden = ['api_key'];
    protected $casts = ['last_synced_at' => 'datetime'];

    public function setApiKeyAttribute(string $value): void
    {
        $this->attributes['api_key'] = Crypt::encryptString($value);
    }

    public function getDecryptedApiKey(): string
    {
        return Crypt::decryptString($this->attributes['api_key']);
    }

    public function company() { return $this->belongsTo(Company::class); }
    public function division() { return $this->belongsTo(Division::class, 'division_id'); }
    public function line() { return $this->belongsTo(ProductionLine::class, 'line_id'); }
    public function mappings(): HasMany { return $this->hasMany(DeviceEmployeeMapping::class, 'device_id'); }
    public function syncLogs(): HasMany { return $this->hasMany(AttendanceSyncLog::class, 'device_id')->latest('started_at'); }
}
