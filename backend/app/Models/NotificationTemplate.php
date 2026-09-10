<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class NotificationTemplate extends Model
{
    use HasUuids;
    protected $fillable = ['company_id', 'code', 'name', 'category', 'subject_template', 'body_template', 'variables', 'send_via_email', 'send_via_sms', 'send_via_in_app', 'send_via_slack', 'status'];
    protected $casts = ['variables' => 'array', 'send_via_email' => 'boolean', 'send_via_sms' => 'boolean', 'send_via_in_app' => 'boolean', 'send_via_slack' => 'boolean'];
}
