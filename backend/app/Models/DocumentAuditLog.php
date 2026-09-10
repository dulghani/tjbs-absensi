<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DocumentAuditLog extends Model
{
    use HasUuids;
    public $timestamps = false;
    protected $table = 'document_audit_logs';
    protected $fillable = ['document_id', 'action_type', 'action_by', 'action_at', 'old_values', 'new_values', 'ip_address', 'user_agent'];
    protected $casts = ['action_at' => 'datetime', 'old_values' => 'array', 'new_values' => 'array'];
}
