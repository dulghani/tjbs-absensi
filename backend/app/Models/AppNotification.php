<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

// Nama "AppNotification" (bukan "Notification") supaya tidak bentrok dengan
// Illuminate\Notifications\Notification bawaan Laravel.
class AppNotification extends Model
{
    use HasUuids;
    protected $table = 'notifications';
    protected $fillable = [
        'company_id', 'recipient_user_id', 'notification_template_id', 'title', 'body', 'payload',
        'related_entity_type', 'related_entity_id', 'action_url', 'status', 'sent_at', 'read_at',
        'email_sent', 'sms_sent', 'priority',
    ];
    protected $casts = ['payload' => 'array', 'sent_at' => 'datetime', 'read_at' => 'datetime', 'email_sent' => 'boolean', 'sms_sent' => 'boolean'];

    public function recipient() { return $this->belongsTo(User::class, 'recipient_user_id'); }
}
