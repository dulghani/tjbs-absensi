<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WorkDayException extends Model
{
    use HasUuids;

    protected $fillable = [
        'company_id', 'exception_date', 'exception_type',
        'replaces_date', 'half_day_minutes', 'description', 'created_by',
    ];

    protected $casts = [
        'exception_date' => 'date:Y-m-d',
        'replaces_date'  => 'date:Y-m-d',
    ];

    public function company() { return $this->belongsTo(Company::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }

    /** Label yang bisa dibaca manusia */
    public function getTypeLabelAttribute(): string
    {
        return match($this->exception_type) {
            'holiday'         => 'Libur',
            'replacement_day' => 'Ganti Hari',
            'half_day'        => 'Setengah Hari',
            default           => $this->exception_type,
        };
    }
}
