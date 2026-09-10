<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    use HasUuids;
    protected $fillable = [
        'company_id', 'category_id', 'document_number', 'title', 'description', 'file_path', 'file_size',
        'file_mime', 'file_hash', 'document_date', 'effective_date', 'expiration_date', 'owned_by_user_id',
        'applicable_to_role', 'applicable_to_organization_type', 'applicable_to_organization_id',
        'requires_acknowledgment', 'requires_approval_workflow_id', 'current_approval_status',
        'version', 'is_current_version', 'parent_document_id', 'change_summary', 'status', 'created_by',
    ];
    protected $casts = [
        'document_date' => 'date:Y-m-d', 'effective_date' => 'date:Y-m-d', 'expiration_date' => 'date:Y-m-d',
        'applicable_to_role' => 'array', 'requires_acknowledgment' => 'boolean', 'is_current_version' => 'boolean',
    ];

    public function category() { return $this->belongsTo(DocumentCategory::class, 'category_id'); }
    public function acknowledgments() { return $this->hasMany(DocumentAcknowledgment::class); }
}
