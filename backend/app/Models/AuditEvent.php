<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class AuditEvent extends Model
{
    public $timestamps = false;
    protected $fillable = ['audit_log_id', 'event_type', 'event_timestamp', 'event_sequence', 'processed_by_system'];
    protected $casts = ['event_timestamp' => 'datetime'];
}
