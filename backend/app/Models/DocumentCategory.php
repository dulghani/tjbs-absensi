<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DocumentCategory extends Model
{
    use HasUuids;
    protected $fillable = ['company_id', 'code', 'name', 'description', 'retention_days', 'status'];
}
