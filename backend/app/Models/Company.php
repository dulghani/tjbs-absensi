<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Company extends Model
{
    use HasUuids;

    protected $fillable = ['code', 'name', 'npwp', 'address', 'city', 'phone', 'email', 'pic_name', 'pic_phone', 'status'];

    public function divisions() { return $this->hasMany(Division::class); }
    public function departments() { return $this->hasMany(Department::class); }
    public function employees() { return $this->hasMany(Employee::class); }
    public function users() { return $this->hasMany(User::class); }
    public function workSettings() { return $this->hasMany(CompanyWorkSetting::class)->latest('effective_date'); }
    public function currentWorkSetting() { return $this->hasOne(CompanyWorkSetting::class)->latestOfMany('effective_date'); }
    public function salaryComponents() { return $this->hasMany(CompanySalaryComponent::class); }
    public function shifts() { return $this->hasMany(Shift::class); }
}
