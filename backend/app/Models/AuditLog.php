<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasUuids;
    protected $fillable = [
        'company_id', 'user_id', 'action_category', 'entity_type', 'entity_id', 'entity_name',
        'old_values', 'new_values', 'changes_summary', 'source_ip', 'user_agent', 'request_id',
        'api_endpoint', 'contains_sensitive_data', 'masked_reason', 'status', 'error_message', 'is_legal_hold',
    ];
    protected $casts = ['old_values' => 'array', 'new_values' => 'array', 'contains_sensitive_data' => 'boolean', 'is_legal_hold' => 'boolean'];

    public function user() { return $this->belongsTo(User::class); }

    /** Helper cepat untuk mencatat audit log dari mana saja di aplikasi. */
    public static function record(array $attrs): self
    {
        return static::create(array_merge([
            'company_id' => auth()->user()?->company_id,
            'user_id' => auth()->id(),
            'source_ip' => request()?->ip(),
            'user_agent' => request()?->userAgent(),
            'request_id' => request()?->header('X-Request-Id'),
            'api_endpoint' => request()?->method() . ' ' . request()?->path(),
            'status' => 'success',
        ], $attrs));
    }
}
