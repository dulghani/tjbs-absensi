<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\ApprovalCenterItem;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function myNotifications(Request $request)
    {
        $query = AppNotification::where('recipient_user_id', $request->user()->id);
        if ($request->status === 'unread') $query->whereNull('read_at');
        return response()->json(['data' => $query->latest()->limit(50)->get()]);
    }

    public function markRead(string $id)
    {
        $notif = AppNotification::findOrFail($id);
        $notif->update(['status' => 'read', 'read_at' => now()]);
        return response()->json(['data' => $notif]);
    }

    public function markAllRead(Request $request)
    {
        AppNotification::where('recipient_user_id', $request->user()->id)->whereNull('read_at')->update(['status' => 'read', 'read_at' => now()]);
        return response()->json(['success' => true]);
    }

    public function approvalCenterPending(Request $request)
    {
        $items = ApprovalCenterItem::where('approver_user_id', $request->user()->id)
            ->where('status', 'pending')
            ->orderByDesc('priority')
            ->orderBy('deadline_at')
            ->get();

        return response()->json([
            'data' => $items,
            'summary' => [
                'total_pending' => $items->count(),
                'total_overdue' => $items->where('is_overdue', true)->count(),
                'high_priority' => $items->whereIn('priority', ['high', 'urgent'])->count(),
            ],
        ]);
    }

    public function approvalCenterHistory(Request $request)
    {
        $items = ApprovalCenterItem::where('approver_user_id', $request->user()->id)
            ->whereIn('status', ['approved', 'rejected'])
            ->latest('updated_at')
            ->limit(50)
            ->get();

        return response()->json(['data' => $items]);
    }
}
