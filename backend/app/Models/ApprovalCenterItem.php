<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ApprovalCenterItem extends Model
{
    use HasUuids;
    protected $fillable = [
        'company_id', 'approver_user_id', 'workflow_instance_id', 'current_step_id', 'item_type', 'item_id',
        'requestor_name', 'requestor_department', 'request_date', 'brief_info', 'status', 'days_pending',
        'escalation_level', 'priority', 'deadline_at', 'is_overdue',
    ];
    protected $casts = ['request_date' => 'datetime', 'deadline_at' => 'datetime', 'is_overdue' => 'boolean'];
}
