<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AuditRetentionPolicy extends Model
{
    use HasUuids;
    protected $fillable = ['company_id', 'entity_type', 'retention_days', 'action_category', 'auto_delete', 'auto_archive', 'archive_location', 'status'];
    protected $casts = ['auto_delete' => 'boolean', 'auto_archive' => 'boolean'];
}
