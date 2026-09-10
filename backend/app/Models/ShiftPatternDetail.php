<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ShiftPatternDetail extends Model
{
    use HasUuids;

    public $timestamps = false;
    protected $fillable = ['pattern_id', 'day_number', 'shift_id', 'notes'];

    public function pattern() { return $this->belongsTo(ShiftPattern::class, 'pattern_id'); }
    public function shift() { return $this->belongsTo(Shift::class); }
}
