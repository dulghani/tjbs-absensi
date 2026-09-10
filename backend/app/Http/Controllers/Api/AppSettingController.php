<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class AppSettingController extends Controller
{
    /** Ambil semua setting aplikasi (publik — tidak butuh auth) */
    public function index()
    {
        $settings = DB::table('app_settings')->get()->keyBy('key');
        $logoPath  = $settings->get('app_logo')?->value;

        return response()->json([
            'data' => [
                'app_name' => $settings->get('app_name')?->value ?? 'OutsourceHR',
                // Kembalikan path relatif (/storage/logos/xxx.png) — frontend tambahkan base URL
                'app_logo' => $logoPath ? Storage::url($logoPath) : null,
            ]
        ]);
    }

    /** Update setting — hanya coordinator/super_admin */
    public function update(Request $request)
    {
        $user = $request->user();
        // Kolom DB adalah 'role' (singular), bukan 'roles'
        $role = $user->role ?? ($user->roles[0] ?? '');
        abort_unless(in_array($role, ['coordinator', 'super_admin']), 403, 'Tidak berwenang.');

        $data = $request->validate([
            'app_name' => 'sometimes|string|max:80',
            'logo'     => 'sometimes|nullable|image|max:2048', // max 2MB
        ]);

        if (isset($data['app_name'])) {
            DB::table('app_settings')->updateOrInsert(
                ['key' => 'app_name'],
                ['value' => $data['app_name'], 'updated_at' => now()]
            );
        }

        if ($request->hasFile('logo')) {
            // Hapus logo lama
            $oldLogo = DB::table('app_settings')->where('key', 'app_logo')->value('value');
            if ($oldLogo) Storage::disk('public')->delete($oldLogo);

            $path = $request->file('logo')->store('logos', 'public');
            DB::table('app_settings')->updateOrInsert(
                ['key' => 'app_logo'],
                ['value' => $path, 'updated_at' => now()]
            );
        }

        if ($request->input('remove_logo') === '1') {
            $oldLogo = DB::table('app_settings')->where('key', 'app_logo')->value('value');
            if ($oldLogo) Storage::disk('public')->delete($oldLogo);
            DB::table('app_settings')->updateOrInsert(
                ['key' => 'app_logo'],
                ['value' => null, 'updated_at' => now()]
            );
        }

        return $this->index();
    }
}
