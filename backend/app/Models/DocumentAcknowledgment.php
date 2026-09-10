<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DocumentAcknowledgment extends Model
{
    use HasUuids;
    protected $fillable = ['document_id', 'employee_id', 'company_id', 'action', 'action_date', 'action_method', 'signature_data', 'device_info', 'acknowledged_by', 'notes', 'ip_address', 'user_agent'];
    protected $casts = ['action_date' => 'datetime', 'device_info' => 'array'];

    public function document() { return $this->belongsTo(Document::class); }
    public function employee() { return $this->belongsTo(Employee::class); }
}
