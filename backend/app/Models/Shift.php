<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Shift extends Model
{
    use HasUuids;

    protected $fillable = ['company_id', 'code', 'name', 'description', 'start_time', 'end_time', 'break_duration_minutes', 'total_work_minutes', 'is_night_shift', 'color_code', 'status'];

    protected $casts = ['is_night_shift' => 'boolean'];

    protected static function booted()
    {
        static::saving(function (Shift $shift) {
            // Auto-hitung total menit kerja dari start/end time - break.
            if ($shift->start_time && $shift->end_time) {
                $start = \Carbon\Carbon::parse($shift->start_time);
                $end = \Carbon\Carbon::parse($shift->end_time);
                if ($end->lessThanOrEqualTo($start)) $end->addDay(); // shift lintas tengah malam
                $shift->total_work_minutes = abs($end->diffInMinutes($start)) - ($shift->break_duration_minutes ?? 0);
            }
        });
    }

    public function company() { return $this->belongsTo(Company::class); }
}
