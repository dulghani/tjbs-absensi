<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class UserNotificationPreference extends Model
{
    use HasUuids;
    protected $fillable = ['user_id', 'company_id', 'notification_template_id', 'enabled', 'email_enabled', 'sms_enabled', 'in_app_enabled', 'quiet_hours_start', 'quiet_hours_end', 'quiet_hours_enabled'];
    protected $casts = ['enabled' => 'boolean', 'email_enabled' => 'boolean', 'sms_enabled' => 'boolean', 'in_app_enabled' => 'boolean', 'quiet_hours_enabled' => 'boolean'];
}
