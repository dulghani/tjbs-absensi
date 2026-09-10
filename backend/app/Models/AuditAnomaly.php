<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AuditAnomaly extends Model
{
    use HasUuids;
    protected $fillable = ['company_id', 'anomaly_type', 'entity_type', 'entity_id', 'description', 'severity', 'flagged_at', 'flagged_by', 'investigated_by', 'investigation_notes', 'status'];
    protected $casts = ['flagged_at' => 'datetime'];
}
