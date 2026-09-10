<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('company:id,name');
        if ($request->company_id && $request->company_id !== 'all') $query->where('company_id', $request->company_id);
        return response()->json(['data' => $query->orderBy('name')->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:30',
            'role' => 'required|in:coordinator,field_officer,hrd,staff_dept',
            'company_id' => 'nullable|uuid|exists:companies,id',
            'department' => 'nullable|string|max:255',
        ]);

        // Batasi role apa saja yang boleh dibuat oleh user yang sedang login,
        // sesuai hierarki: coordinator > field_officer > hrd > staff_dept.
        $creator = $request->user();
        $allowedRoles = match ($creator->role) {
            'coordinator' => ['coordinator', 'field_officer', 'hrd', 'staff_dept'],
            'field_officer' => ['hrd', 'staff_dept'],
            'hrd' => ['staff_dept'],
            default => [],
        };
        abort_unless(in_array($data['role'], $allowedRoles, true), 403, 'Anda tidak berwenang membuat user dengan role ini.');

        $tempPassword = Str::random(10);
        $user = User::create($data + ['password' => Hash::make($tempPassword), 'status' => 'active']);

        AuditLog::record(['company_id' => $user->company_id, 'action_category' => 'create', 'entity_type' => 'user', 'entity_id' => $user->id, 'entity_name' => $user->name, 'changes_summary' => "Membuat user baru dengan role {$user->role}"]);

        // Kembalikan temp_password agar admin bisa menyampaikan ke user baru
        // Juga kirim email notifikasi jika mail dikonfigurasi
        try {
            $appName = \Illuminate\Support\Facades\DB::table('app_settings')->where('key','app_name')->value('value') ?? 'OutsourceHR';
            $user->notify(new \App\Notifications\TempPasswordNotification($tempPassword, $appName));
        } catch (\Throwable $e) {
            // Email gagal tidak menghentikan proses — admin tetap bisa lihat password di UI
            \Illuminate\Support\Facades\Log::warning('Email notifikasi user gagal dikirim: ' . $e->getMessage());
        }

        return response()->json(['data' => $user, 'temp_password' => $tempPassword], 201);
    }

    public function update(Request $request, string $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'name'       => 'sometimes|string|max:255',
            'phone'      => 'nullable|string|max:30',
            'department' => 'nullable|string|max:255',
            'company_id' => 'nullable|uuid|exists:companies,id',
            'status'     => 'nullable|in:active,inactive',
            'role'       => 'sometimes|in:coordinator,field_officer,hrd,staff_dept',
        ]);

        $user->update($data);
        AuditLog::record(['company_id' => $user->company_id, 'action_category' => 'update', 'entity_type' => 'user', 'entity_id' => $user->id, 'entity_name' => $user->name]);

        return response()->json(['data' => $user]);
    }

    public function destroy(string $id)
    {
        $user = User::findOrFail($id);
        AuditLog::record(['company_id' => $user->company_id, 'action_category' => 'delete', 'entity_type' => 'user', 'entity_id' => $user->id, 'entity_name' => $user->name]);
        $user->delete();
        return response()->json(['success' => true]);
    }

    public function resetPassword(string $id)
    {
        $user = User::findOrFail($id);
        $newPassword = Str::random(10);
        $user->update(['password' => Hash::make($newPassword)]);

        AuditLog::record(['company_id' => $user->company_id, 'action_category' => 'update', 'entity_type' => 'user', 'entity_id' => $user->id, 'entity_name' => $user->name, 'changes_summary' => 'Reset password oleh admin']);

        return response()->json(['data' => $user, 'temp_password' => $newPassword]);
    }
}
