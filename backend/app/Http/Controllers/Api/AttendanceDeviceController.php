<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SyncFingerspotAttendanceJob;
use App\Models\AttendanceDevice;
use App\Models\AttendanceSyncLog;
use App\Models\DeviceEmployeeMapping;
use App\Services\Attendance\FingerspotService;
use App\Services\Employee\FingerspotEmployeeImportService;
use App\Services\Employee\FingerspotEmployeeSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AttendanceDeviceController extends Controller
{
    /** Buat karyawan dari log absensi yang sudah ada tapi masih unmapped (PIN belum terpetakan).
     *  Berguna untuk "catch up" setelah banyak log masuk sebelum karyawan dibuat. */
    public function createEmployeesFromLogs(Request $request, string $id)
    {
        $device = AttendanceDevice::findOrFail($id);

        // Cari PIN yang ada di attendance_logs untuk device ini tapi belum ada di mapping
        $mappedPins = \App\Models\DeviceEmployeeMapping::where('device_id', $id)
            ->where('status', 'active')
            ->pluck('device_pin')
            ->toArray();

        // Ambil log mentah yang unmapped — kita butuh PIN dan contoh datanya
        $unmappedLogs = \App\Models\AttendanceLog::where('device_id', $id)
            ->where('employee_id', \DB::raw('\'00000000-0000-0000-0000-000000000000\'')) // ini tidak akan match
            ->get(); // ini tidak akan jalan — kita pakai raw query di bawah

        // Query yang benar: cari attendance_logs tanpa mapping
        $rawLogs = \DB::select("
            SELECT DISTINCT al.device_id, al.company_id,
                   dm.device_pin as pin
            FROM attendance_logs al
            LEFT JOIN device_employee_mappings dm
                ON dm.employee_id = al.employee_id AND dm.device_id = al.device_id
            WHERE al.device_id = ?
              AND al.employee_id IN (
                  SELECT employee_id FROM device_employee_mappings
                  WHERE device_id = ? AND status = 'active'
              )
        ", [$id, $id]);

        // Cara yang lebih simpel: re-sync semua raw log dari Fingerspot API untuk 14 hari terakhir
        // tapi dengan auto-create aktif — karena sekarang processSingleLog sudah auto-create
        $created = 0; $mapped = 0;

        // Ambil PIN yang unmapped dari Fingerspot langsung (hari ini sebagai sampel)
        $service = new \App\Services\Attendance\FingerspotService($device->cloud_id, $device->getDecryptedApiKey());
        $todayLogs = $service->fetchAttendanceLog(now()->format('Y-m-d'));

        $existingMappings = \App\Models\DeviceEmployeeMapping::where('device_id', $id)
            ->where('status', 'active')
            ->pluck('employee_id', 'device_pin');

        $unmappedPins = collect($todayLogs)
            ->unique('PIN')
            ->filter(fn ($r) => ! isset($existingMappings[(string) ($r['PIN'] ?? '')]))
            ->values();

        foreach ($unmappedPins as $raw) {
            $pin = (string) ($raw['PIN'] ?? '');
            if (! $pin) continue;

            $name = trim($raw['Name'] ?? '');
            if (! $name) $name = "Karyawan PIN-{$pin}";

            $employee = \App\Models\Employee::where('company_id', $device->company_id)
                ->where('nik', $pin)->first();

            if (! $employee) {
                $employee = \App\Models\Employee::create([
                    'company_id'        => $device->company_id,
                    'division_id'       => $device->division_id,
                    'name'              => $name,
                    'nik'               => $pin,
                    'position'          => $device->default_position,
                    'status'            => 'active',
                    'join_date'         => now()->format('Y-m-d'),
                    'employment_status' => $device->default_employment_status ?? 'contract',
                ]);
                $created++;
            }

            \App\Models\DeviceEmployeeMapping::firstOrCreate(
                ['device_id' => $id, 'employee_id' => $employee->id],
                ['device_pin' => $pin, 'status' => 'active']
            );
            $mapped++;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'employees_created' => $created,
                'mappings_added' => $mapped,
                'message' => "{$created} karyawan baru dibuat, {$mapped} PIN dipetakan dari data log hari ini.",
            ],
        ]);
    }

    /** Sinkronisasi karyawan langsung dari Fingerspot API (tanpa file Excel). */
    public function syncEmployeesFromApi(Request $request, string $id, FingerspotEmployeeSyncService $service)
    {
        $device = AttendanceDevice::findOrFail($id);

        $result = $service->syncFromDevice(
            $device->id,
            $device->cloud_id,
            $device->getDecryptedApiKey(),
            $device->company_id,
        );

        return response()->json(['success' => true, 'data' => $result]);
    }

    /** Import karyawan global dari menu Karyawan (tidak terikat device tertentu). */
    public function importGlobal(Request $request, FingerspotEmployeeImportService $service)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
            'company_id' => 'nullable|uuid|exists:companies,id',
        ]);

        $uploaded = $request->file('file');
        $tempPath = $uploaded->store('imports/tmp');
        $fullPath = Storage::path($tempPath);

        try {
            $result = $service->importFromFile($fullPath, $request->company_id ?: null, null);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } finally {
            @unlink($fullPath);
        }

        return response()->json(['success' => true, 'data' => $result]);
    }
    public function index(Request $request)
    {
        $devices = AttendanceDevice::with(['company:id,name', 'division:id,name'])
            ->when($request->company_id, fn ($q) => $q->where('company_id', $request->company_id))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $devices]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'line_id' => 'nullable|uuid|exists:production_lines,id',
            'division_id' => 'nullable|uuid|exists:divisions,id',
            'name' => 'required|string|max:255',
            'cloud_id' => 'required|string|max:100',
            'api_key' => 'required|string|max:255',
            'location' => 'nullable|string|max:255',
            'timezone' => 'nullable|string|max:50',
            'sync_mode' => 'nullable|in:scheduled,manual',
            'sync_interval_minutes' => 'nullable|integer|min:5|max:1440',
            'default_position' => 'nullable|string|max:150',
            'default_employment_status' => 'nullable|in:permanent,contract,probation,temporary',
        ]);

        $device = AttendanceDevice::create($data + ['brand' => 'fingerspot', 'status' => 'active']);

        return response()->json(['data' => $device], 201);
    }

    public function update(Request $request, string $id)
    {
        $device = AttendanceDevice::findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'line_id' => 'nullable|uuid|exists:production_lines,id',
            'division_id' => 'nullable|uuid|exists:divisions,id',
            'cloud_id' => 'sometimes|string|max:100',
            'api_key' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'sync_mode' => 'nullable|in:scheduled,manual',
            'sync_interval_minutes' => 'nullable|integer|min:5|max:1440',
            'default_position' => 'nullable|string|max:150',
            'default_employment_status' => 'nullable|in:permanent,contract,probation,temporary',
            'status' => 'nullable|in:active,inactive',
        ]);

        if (empty($data['api_key'])) unset($data['api_key']);

        $device->update($data);

        return response()->json(['data' => $device]);
    }

    public function destroy(string $id)
    {
        AttendanceDevice::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    public function testConnection(string $id)
    {
        $device = AttendanceDevice::findOrFail($id);
        $service = new FingerspotService($device->cloud_id, $device->getDecryptedApiKey());
        $result = $service->testConnection();

        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function syncNow(Request $request, string $id)
    {
        $device = AttendanceDevice::findOrFail($id);

        $data = $request->validate([
            'date' => 'nullable|date',
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
        ]);

        // Range tanggal (backdate sync) kalau from+to diisi, kalau tidak sync 1 tanggal saja.
        if (! empty($data['from']) && ! empty($data['to'])) {
            $cursor = \Carbon\Carbon::parse($data['from']);
            $end = \Carbon\Carbon::parse($data['to']);
            $count = 0;
            while ($cursor->lte($end)) {
                SyncFingerspotAttendanceJob::dispatch($device->id, $cursor->format('Y-m-d'));
                $cursor->addDay();
                $count++;
            }
            return response()->json(['success' => true, 'message' => "{$count} tanggal dijadwalkan untuk sync. Data yang sudah ada otomatis di-skip."]);
        }

        $date = $data['date'] ?? now()->format('Y-m-d');
        SyncFingerspotAttendanceJob::dispatch($device->id, $date);

        return response()->json(['success' => true, 'message' => 'Sinkronisasi dijadwalkan, cek riwayat sync untuk hasilnya.']);
    }

    public function syncLogs(string $id)
    {
        $logs = AttendanceSyncLog::where('device_id', $id)->latest('started_at')->limit(20)->get();
        return response()->json(['data' => $logs]);
    }

    /**
     * Tampilkan status sync per tanggal dalam rentang tertentu — supaya user bisa lihat
     * "tanggal mana yang sudah sync, mana yang belum" tanpa perlu cek satu-satu manual.
     * Kalau 1 tanggal punya beberapa kali percobaan sync, ambil yang PALING BARU saja.
     */
    public function syncCoverage(Request $request, string $id)
    {
        $from = $request->input('from', now()->subDays(13)->format('Y-m-d'));
        $to = $request->input('to', now()->format('Y-m-d'));

        $logs = AttendanceSyncLog::where('device_id', $id)
            ->whereBetween('sync_date', [$from, $to])
            ->orderBy('sync_date')
            ->orderByDesc('started_at')
            ->get()
            ->unique('sync_date') // ambil percobaan terbaru per tanggal (sudah urut desc di dalam tanggal yg sama)
            ->keyBy(fn ($log) => $log->sync_date->format('Y-m-d'));

        $coverage = [];
        $cursor = \Carbon\Carbon::parse($from);
        $end = \Carbon\Carbon::parse($to);
        while ($cursor->lte($end)) {
            $dateStr = $cursor->format('Y-m-d');
            $log = $logs->get($dateStr);
            $coverage[] = [
                'date' => $dateStr,
                'status' => $log?->status ?? 'never', // never = belum pernah sync sama sekali
                'records_inserted' => $log?->records_inserted ?? 0,
                'records_unmapped' => $log?->records_unmapped ?? 0,
            ];
            $cursor->addDay();
        }

        return response()->json(['data' => $coverage]);
    }

    public function mappings(string $id)
    {
        $mappings = DeviceEmployeeMapping::with('employee:id,name,nik')->where('device_id', $id)->get();
        return response()->json(['data' => $mappings]);
    }

    public function addMapping(Request $request, string $id)
    {
        $data = $request->validate([
            'device_pin' => 'required|string|max:50',
            'employee_id' => 'required|uuid|exists:employees,id',
        ]);

        $mapping = DeviceEmployeeMapping::updateOrCreate(
            ['device_id' => $id, 'device_pin' => $data['device_pin']],
            ['employee_id' => $data['employee_id'], 'status' => 'active']
        );

        return response()->json(['data' => $mapping], 201);
    }

    public function removeMapping(string $id, string $mappingId)
    {
        DeviceEmployeeMapping::where('device_id', $id)->where('id', $mappingId)->delete();
        return response()->json(['success' => true]);
    }

    /**
     * Import karyawan dari file .xlsx export Fingerspot langsung lewat UI.
     * Semua karyawan yang diimport otomatis masuk ke company milik device ini,
     * dan PIN langsung dipetakan ke device ini juga (device sudah pasti diketahui,
     * beda dengan versi CLI yang company-nya bisa auto-detect dari kolom Kantor).
     */
    public function importEmployees(Request $request, string $id, FingerspotEmployeeImportService $service)
    {
        $device = AttendanceDevice::findOrFail($id);

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ]);

        $uploaded = $request->file('file');
        $tempPath = $uploaded->store('imports/tmp');
        $fullPath = Storage::path($tempPath);

        try {
            $result = $service->importFromFile($fullPath, $device->company_id, $device->id);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } finally {
            @unlink($fullPath);
        }

        return response()->json(['success' => true, 'data' => $result]);
    }
}
