<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AuditDataAccessLog extends Model
{
    use HasUuids;
    protected $fillable = ['company_id', 'user_id', 'table_name', 'column_names', 'record_ids', 'query_type', 'query_summary', 'access_method', 'access_time', 'source_ip', 'contains_pii', 'contains_salary', 'status'];
    protected $casts = ['column_names' => 'array', 'record_ids' => 'array', 'access_time' => 'datetime', 'contains_pii' => 'boolean', 'contains_salary' => 'boolean'];
}
