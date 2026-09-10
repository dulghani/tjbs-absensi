<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WorkflowStepApprover extends Model
{
    use HasUuids;
    public $timestamps = false;
    protected $fillable = ['step_id', 'approver_user_id', 'approver_role', 'approver_position', 'custom_rule_json', 'order_priority', 'is_optional'];
    protected $casts = ['custom_rule_json' => 'array', 'is_optional' => 'boolean'];
}
