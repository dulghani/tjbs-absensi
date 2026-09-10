<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::with('user:id,name,role');

        if ($request->entity_type && $request->entity_type !== 'all') $query->where('entity_type', $request->entity_type);
        if ($request->user_id) $query->where('user_id', $request->user_id);
        if ($request->date_from) $query->where('created_at', '>=', $request->date_from);
        if ($request->date_to) $query->where('created_at', '<=', $request->date_to);

        return response()->json(['data' => $query->latest()->paginate($request->per_page ?? 50)]);
    }

    public function show(string $id)
    {
        return response()->json(['data' => AuditLog::with('user')->findOrFail($id)]);
    }

    public function userActivity(Request $request, string $userId)
    {
        $query = AuditLog::where('user_id', $userId);
        if ($request->from_date) $query->where('created_at', '>=', $request->from_date);
        if ($request->to_date) $query->where('created_at', '<=', $request->to_date);

        $logs = $query->get();

        return response()->json(['data' => [
            'total_actions' => $logs->count(),
            'action_breakdown' => $logs->countBy('action_category'),
            'entities_modified' => $logs->countBy('entity_type'),
            'failed_actions' => $logs->where('status', 'failure')->values(),
        ]]);
    }
}
