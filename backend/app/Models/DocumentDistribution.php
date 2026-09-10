<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DocumentDistribution extends Model
{
    use HasUuids;
    public $timestamps = false;
    protected $fillable = ['document_id', 'recipient_type', 'recipient_user_id', 'recipient_role', 'recipient_organization_type', 'recipient_organization_id', 'distributed_at', 'distributed_by', 'expiration_date', 'status'];
    protected $casts = ['distributed_at' => 'datetime', 'expiration_date' => 'date:Y-m-d'];
}
