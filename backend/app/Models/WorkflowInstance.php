<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WorkflowInstance extends Model
{
    use HasUuids;
    protected $fillable = [
        'company_id', 'workflow_definition_id', 'entity_type', 'entity_id', 'current_step_id',
        'current_status', 'submitted_at', 'completed_at', 'cancelled_at', 'created_by',
        'final_decision', 'final_decision_by', 'final_decision_at', 'rejection_reason', 'revision_count', 'context_data',
    ];
    protected $casts = ['submitted_at' => 'datetime', 'completed_at' => 'datetime', 'cancelled_at' => 'datetime', 'final_decision_at' => 'datetime', 'context_data' => 'array'];

    public function definition() { return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id'); }
    public function currentStep() { return $this->belongsTo(WorkflowStep::class, 'current_step_id'); }
    public function approvals() { return $this->hasMany(WorkflowApproval::class); }
    public function entity() { return $this->morphTo(); } // opsional, kalau mau pakai polymorphic
}
