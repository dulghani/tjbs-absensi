<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CalendarDate extends Model
{
    use HasUuids;

    protected $fillable = ['calendar_id', 'date', 'day_type', 'name', 'description', 'is_paid', 'work_multiplier'];
    protected $casts = ['date' => 'date:Y-m-d', 'is_paid' => 'boolean'];

    public function calendar() { return $this->belongsTo(CompanyCalendar::class, 'calendar_id'); }
}
