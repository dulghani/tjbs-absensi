<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WorkflowDefinition extends Model
{
    use HasUuids;
    protected $fillable = ['company_id', 'code', 'name', 'entity_type', 'description', 'initial_status', 'final_status', 'rejection_status', 'trigger_conditions', 'auto_approve_conditions', 'status', 'version', 'created_by'];
    protected $casts = ['trigger_conditions' => 'array', 'auto_approve_conditions' => 'array'];

    public function steps() { return $this->hasMany(WorkflowStep::class, 'workflow_id')->orderBy('step_order'); }
}
