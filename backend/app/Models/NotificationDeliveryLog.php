<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class NotificationDeliveryLog extends Model
{
    use HasUuids;
    protected $fillable = ['notification_id', 'delivery_channel', 'recipient_address', 'status', 'delivery_time', 'error_message', 'retry_count', 'max_retries', 'external_reference_id'];
    protected $casts = ['delivery_time' => 'datetime'];
}
