<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AttendanceSyncLog extends Model
{
    use HasUuids;
    protected $fillable = ['device_id', 'sync_date', 'status', 'records_fetched', 'records_inserted', 'records_skipped', 'records_unmapped', 'error_message', 'started_at', 'finished_at'];
    protected $casts = ['sync_date' => 'date:Y-m-d', 'started_at' => 'datetime', 'finished_at' => 'datetime'];

    public function device() { return $this->belongsTo(AttendanceDevice::class, 'device_id'); }

    public function getDurationSecondsAttribute(): ?int
    {
        if (! $this->finished_at) return null;
        return abs($this->finished_at->diffInSeconds($this->started_at));
    }
}
