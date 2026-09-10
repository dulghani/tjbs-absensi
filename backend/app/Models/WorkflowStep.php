<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WorkflowStep extends Model
{
    use HasUuids;
    protected $fillable = ['workflow_id', 'step_order', 'step_code', 'step_name', 'description', 'approval_type', 'approver_selection', 'approvers_json', 'can_reject', 'can_revise', 'parallel_execution', 'step_timeout_hours', 'default_action', 'status'];
    protected $casts = ['approvers_json' => 'array', 'can_reject' => 'boolean', 'can_revise' => 'boolean', 'parallel_execution' => 'boolean'];

    public function workflow() { return $this->belongsTo(WorkflowDefinition::class, 'workflow_id'); }
    public function approvers() { return $this->hasMany(WorkflowStepApprover::class, 'step_id'); }
}
