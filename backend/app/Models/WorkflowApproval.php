<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WorkflowApproval extends Model
{
    use HasUuids;
    public $timestamps = false;
    protected $fillable = ['workflow_instance_id', 'step_id', 'approver_user_id', 'action', 'reason', 'comments', 'attachments', 'approved_at', 'approval_time_minutes'];
    protected $casts = ['attachments' => 'array', 'approved_at' => 'datetime'];

    public function approver() { return $this->belongsTo(User::class, 'approver_user_id'); }
}
