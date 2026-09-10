<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CompanyCalendar extends Model
{
    use HasUuids;

    protected $fillable = ['company_id', 'calendar_year'];

    public function dates() { return $this->hasMany(CalendarDate::class, 'calendar_id'); }
}
