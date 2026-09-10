<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\OvertimeRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OvertimeController extends Controller
{
    public function index(Request $request)
    {
        $query = OvertimeRequest::with([
            'details.employee:id,name',
            'requestedBy:id,name',
        ]);

        if ($request->company_id && $request->company_id !== 'all') $query->where('company_id', $request->company_id);
        if ($request->status && $request->status !== 'all') $query->where('status', $request->status);
        if ($request->from_date) $query->whereDate('overtime_date', '>=', $request->from_date);
        if ($request->to_date)   $query->whereDate('overtime_date', '<=', $request->to_date);

        $requests = $query->latest('overtime_date')->get();

        // Inject data absensi aktual per detail item (jam pulang, lembur aktual)
        $requests->each(function (OvertimeRequest $ot) {
            $ot->details->each(function ($detail) use ($ot) {
                $summary = \App\Models\AttendanceSummary::where('employee_id', $detail->employee_id)
                    ->where('attendance_date', $ot->overtime_date)
                    ->first(['actual_end_time', 'overtime_minutes', 'overtime_verified', 'shift_type']);
                $detail->attendance = $summary ? [
                    'actual_end_time'   => $summary->actual_end_time,
                    'overtime_minutes'  => $summary->overtime_minutes,
                    'overtime_verified' => $summary->overtime_verified,
                    'shift_type'        => $summary->shift_type,
                ] : null;
            });
        });

        return response()->json(['data' => $requests]);
    }

    public function show(string $id)
    {
        return response()->json(['data' => OvertimeRequest::with(['details.employee', 'requestedBy:id,name'])->findOrFail($id)]);
    }

    /**
     * Buat pengajuan lembur dengan banyak item karyawan sekaligus (fitur "multiple add").
     * Payload: { company_id, department, overtime_date, description, items: [{employee_id, start, end, notes}] }
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'company_id'   => 'required|uuid|exists:companies,id',
            'department'   => 'nullable|string|max:255',
            'overtime_date'=> 'required|date',
            'description'  => 'nullable|string',
            'items'        => 'required|array|min:1',
            'items.*.employee_id' => 'required|uuid|exists:employees,id',
            'items.*.start'       => 'required',
            'items.*.end'         => 'required',
            'items.*.notes'       => 'nullable|string',
        ]);

        $overtimeRequest = DB::transaction(function () use ($data, $request) {
            $company = \App\Models\Company::findOrFail($data['company_id']);
            $requestNumber = $this->generateRequestNumber($company->code, $data['overtime_date']);

            $header = \App\Models\OvertimeRequest::create([
                'request_number' => $requestNumber,
                'company_id' => $data['company_id'],
                'department' => $data['department'],
                'requested_by' => $request->user()->id,
                'overtime_date' => $data['overtime_date'],
                'description' => $data['description'] ?? null,
                'status' => 'pending',
            ]);

            foreach ($data['items'] as $item) {
                $duration = $this->calcDurationMinutes($item['start'], $item['end']);
                $header->details()->create([
                    'employee_id' => $item['employee_id'],
                    'plan_start_time' => $item['start'],
                    'plan_end_time' => $item['end'],
                    'plan_duration_minutes' => $duration,
                    'notes' => $item['notes'] ?? null,
                    'status' => 'pending',
                ]);
            }

            return $header;
        });

        AuditLog::record([
            'company_id' => $overtimeRequest->company_id,
            'action_category' => 'create', 'entity_type' => 'overtime_request', 'entity_id' => $overtimeRequest->id,
            'entity_name' => $overtimeRequest->request_number,
            'changes_summary' => count($data['items']) . ' karyawan diajukan lembur',
        ]);

        return response()->json(['data' => $overtimeRequest->load('details.employee')], 201);
    }

    /** Approve satu item (karyawan) dalam sebuah pengajuan lembur. */
    public function approveItem(Request $request, string $requestId, string $itemId)
    {
        $header = OvertimeRequest::findOrFail($requestId);
        $item   = $header->details()->findOrFail($itemId);
        $item->update(['status' => 'approved']);
        $this->finalizeIfComplete($header, $request->user()->id);

        // Recalculate attendance untuk karyawan ini di tanggal lembur
        $this->triggerRecalculate($item->employee_id, $header->overtime_date);

        return response()->json(['data' => $header->fresh('details.employee')]);
    }

    public function rejectItem(Request $request, string $requestId, string $itemId)
    {
        $header = OvertimeRequest::findOrFail($requestId);
        $item   = $header->details()->findOrFail($itemId);
        $item->update(['status' => 'rejected']);
        $this->finalizeIfComplete($header, $request->user()->id);

        // Recalculate agar overtime_verified diperbarui
        $this->triggerRecalculate($item->employee_id, $header->overtime_date);

        return response()->json(['data' => $header->fresh('details.employee')]);
    }

    public function approveAll(Request $request, string $requestId)
    {
        $header = OvertimeRequest::findOrFail($requestId);
        $header->details()->update(['status' => 'approved']);
        $header->update(['status' => 'approved', 'approved_by' => $request->user()->id, 'approved_at' => now()]);

        AuditLog::record(['company_id' => $header->company_id, 'action_category' => 'approve', 'entity_type' => 'overtime_request', 'entity_id' => $header->id, 'entity_name' => $header->request_number, 'changes_summary' => 'Menyetujui semua item lembur']);

        // Recalculate semua karyawan dalam pengajuan ini
        foreach ($header->details as $item) {
            $this->triggerRecalculate($item->employee_id, $header->overtime_date);
        }

        return response()->json(['data' => $header->fresh('details.employee')]);
    }

    /**
     * Trigger recalculate attendance summary untuk 1 karyawan 1 tanggal.
     * Dijalankan setelah approve/reject lembur supaya overtime_verified langsung update.
     */
    protected function triggerRecalculate(string $employeeId, $date): void
    {
        $dateStr = is_string($date) ? $date : $date->format('Y-m-d');
        try {
            \App\Jobs\RecalculateAttendanceSummaryJob::dispatch($employeeId, $dateStr);
        } catch (\Throwable $e) {
            // Fallback: run sync kalau queue tidak tersedia
            try {
                app(\App\Services\Attendance\AttendanceCalculationService::class)
                    ->calculateForEmployeeDate($employeeId, $dateStr);
            } catch (\Throwable $ignored) {}
        }
    }

    protected function finalizeIfComplete(OvertimeRequest $header, string $approverId): void
    {
        $items = $header->details;
        if ($items->contains('status', 'pending')) return; // masih ada yang belum diputuskan

        $header->update([
            'status' => $items->contains('status', 'approved') ? 'approved' : 'rejected',
            'approved_by' => $approverId,
            'approved_at' => now(),
        ]);
    }

    protected function calcDurationMinutes(string $start, string $end): int
    {
        [$sh, $sm] = array_map('intval', explode(':', $start));
        [$eh, $em] = array_map('intval', explode(':', $end));
        $minutes = ($eh * 60 + $em) - ($sh * 60 + $sm);
        return $minutes < 0 ? $minutes + 1440 : $minutes; // lintas tengah malam
    }

    protected function generateRequestNumber(string $companyCode, string $date): string
    {
        $ym = date('Ym', strtotime($date));
        $prefix = "OT-{$companyCode}-{$ym}-";
        $count = OvertimeRequest::where('request_number', 'like', "{$prefix}%")->count();
        return $prefix . str_pad($count + 1, 3, '0', STR_PAD_LEFT);
    }

    public function destroy(string $id)
    {
        $request = OvertimeRequest::findOrFail($id);

        // Hanya SPL yang masih pending yang bisa dihapus
        $hasApproved = $request->details()->where('status', 'approved')->exists();
        if ($hasApproved) {
            return response()->json(['message' => 'SPL yang sudah ada item disetujui tidak dapat dihapus.'], 422);
        }

        $request->details()->delete();
        $request->delete();

        return response()->json(['success' => true, 'message' => 'SPL berhasil dihapus.']);
    }
}
