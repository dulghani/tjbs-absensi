<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WorkflowTransition extends Model
{
    use HasUuids;
    public $timestamps = false;
    protected $fillable = ['workflow_instance_id', 'from_step_id', 'to_step_id', 'transition_type', 'reason', 'triggered_by', 'triggered_at', 'condition_met', 'condition_details'];
    protected $casts = ['triggered_at' => 'datetime', 'condition_met' => 'boolean', 'condition_details' => 'array'];
}
