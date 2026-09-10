<?php

namespace App\Services\Attendance;

use App\Models\AttendanceLog;
use App\Models\AttendanceSummary;
use App\Models\CompanyWorkSetting;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\LeaveRequest;
use App\Models\OvertimeRequestDetail;
use Carbon\Carbon;

/**
 * ============================================================
 * SISTEM HYBRID DURATION-BASED
 * ============================================================
 * Implementasi mengikuti spesifikasi:
 *
 * 1. NORMALISASI TANGGAL KERJA (Business Date)
 *    Log yang terjadi antara 00:00 s/d (cutoff - 1 menit) dianggap masih
 *    hari kerja SEBELUMNYA. Default cutoff = 05:00.
 *    → Karyawan scan pulang jam 01:10 tetap dihitung sebagai pulang kemarin.
 *
 * 2. PAIRING MIN/MAX
 *    Scan_Masuk = MIN(semua scan dalam business date window)
 *    Scan_Pulang = MAX(semua scan dalam business date window)
 *    → Tidak bergantung pada label "check_in"/"check_out" dari mesin
 *      (yang terbukti kadang tidak akurat). Lebih robust untuk multi-scan.
 *
 * 3. BRANCHING KONDISI
 *    Kondisi 1 (Undertime)  : durasi_aktual < target_durasi
 *    Kondisi 2 (Normal)     : target <= durasi_aktual < target + threshold → kelebihan hangus
 *    Kondisi 3 (Overtime)   : durasi_aktual - target >= threshold → hitung lembur + cek SPL
 *    Kondisi 4 (Gantung)    : ada masuk tapi tidak ada pulang (atau sebaliknya)
 *
 * 4. VERIFIKASI SPL
 *    Lembur baru dihitung JIKA karyawan terdaftar di Surat Perintah Lembur (overtime_requests)
 *    yang disetujui untuk tanggal tersebut. Jika tidak ada SPL → kelebihan durasi diabaikan
 *    (tampil sebagai warning kuning, bukan lembur hijau).
 * ============================================================
 */
class AttendanceCalculationService
{
    public function calculateForEmployeeDate(string $employeeId, string $date): AttendanceSummary
    {
        $employee = Employee::findOrFail($employeeId);

        // Cuti disetujui? Tandai on_leave dan selesai.
        if ($this->isOnApprovedLeave($employeeId, $date)) {
            return $this->upsert($employeeId, $employee->company_id, $date, [
                'attendance_status' => 'on_leave',
                'expected_work_minutes' => 0,
                'status' => 'auto_finalized',
            ]);
        }

        // Resolve shift/aturan kerja untuk tanggal ini (termasuk override harian & threshold).
        [$expectedStart, $expectedEnd, $expectedWorkMinutes, $overtimeThreshold, $cutoff] =
            $this->resolveExpectedShift($employee, $date);

        // Ambil SEMUA log dalam business-date window untuk tanggal ini.
        $logs = $this->getLogsForBusinessDate($employeeId, $date, $cutoff);

        // --- Kondisi: Tidak ada log sama sekali ---
        if ($logs->isEmpty()) {
            if (! $expectedStart) {
                // Hari libur terjadwal DAN tidak ada log → rest_day.
                return $this->upsert($employeeId, $employee->company_id, $date, [
                    'attendance_status' => 'rest_day', 'expected_work_minutes' => 0, 'status' => 'auto_finalized',
                ]);
            }
            // Ada jadwal kerja tapi tidak scan sama sekali → absen.
            return $this->upsert($employeeId, $employee->company_id, $date, [
                'attendance_status' => 'absent', 'expected_start_time' => $expectedStart,
                'expected_end_time' => $expectedEnd, 'expected_work_minutes' => $expectedWorkMinutes,
                'status' => 'auto_finalized',
            ]);
        }

        // --- PAIRING: MIN = masuk, MAX = pulang ---
        // ─── Cek Kalender Pengecualian ─────────────────────────────────────────
        // Sebelum menggunakan shift/jadwal normal, cek apakah tanggal ini punya pengecualian.
        $exception = \App\Models\WorkDayException::where('company_id', $employee->company_id)
            ->where('exception_date', $date)
            ->first();

        if ($exception) {
            match ($exception->exception_type) {
                // Libur nasional / cuti bersama → tidak ada kerja yang diharapkan
                'holiday' => $expectedWorkMinutes = 0,
                // Ganti hari → gunakan target menit normal tapi FORCE hari ini jadi hari kerja
                // (override jadwal libur mingguan — absen dihitung normal, bukan lembur merah)
                'replacement_day' => null, // biarkan logika normal berjalan di bawah
                // Setengah hari → gunakan menit yang ditentukan
                'half_day' => $expectedWorkMinutes = $exception->half_day_minutes ?? intdiv($expectedWorkMinutes ?? 480, 2),
                default => null,
            };

            // Untuk hari libur (holiday): kalau ada scan, tetap catat tapi semua = lembur merah
            if ($exception->exception_type === 'holiday') {
                if (empty($logs)) {
                    // Tidak masuk di hari libur → catat sebagai "libur" bukan "absen"
                    return $this->upsert($employeeId, $employee->company_id, $date, [
                        'attendance_status'    => 'absent',
                        'expected_start_time'  => null,
                        'expected_end_time'    => null,
                        'expected_work_minutes'=> 0,
                        'actual_work_minutes'  => 0,
                        'productive_work_minutes' => 0,
                        'status' => 'auto_finalized',
                        'notes'  => 'Hari libur: ' . ($exception->description ?? 'libur nasional/cuti bersama'),
                    ]);
                }
                // Ada scan di hari libur → lembur merah
                $expectedStart = null;
                $expectedEnd = null;
                $expectedWorkMinutes = 0;
            }

            // Untuk ganti hari → jadwal normal sudah ditentukan, TIDAK override ke 0
            // (karyawan kerja di Minggu tapi dianggap hari kerja biasa)
        }
        $scanMasuk = $logs->min('logged_time');
        $scanPulang = $logs->max('logged_time');

        $actualStart = Carbon::parse($scanMasuk);
        $actualEnd = Carbon::parse($scanPulang);

        // --- Kondisi 4 (Gantung): hanya 1 scan, masuk = pulang ---
        // Hanya tandai 'incomplete' kalau sudah melewati ekspektasi jam pulang + buffer 30 menit.
        // Sebelum itu, karyawan mungkin masih bekerja (scan masuk belum pulang = normal).
        if ($actualStart->equalTo($actualEnd)) {
            $expectedEndDt = $expectedEnd
                ? Carbon::parse($date . ' ' . $expectedEnd)
                : Carbon::parse($date . ' ' . $actualStart->format('H:i:s'))->addMinutes($expectedWorkMinutes);

            // Kalau jam pulang ekspektasi lintas tengah malam, geser +1 hari.
            if ($expectedEnd && Carbon::parse($expectedEnd)->lt(Carbon::parse($expectedStart ?? '00:00'))) {
                $expectedEndDt->addDay();
            }

            $nowJkt = Carbon::now('Asia/Jakarta');
            $stillWorking = $nowJkt->lt($expectedEndDt->addMinutes(30));

            return $this->upsert($employeeId, $employee->company_id, $date, [
                'attendance_status' => $stillWorking ? 'present' : 'incomplete',
                'expected_start_time' => $expectedStart, 'expected_end_time' => $expectedEnd,
                'actual_start_time' => $actualStart->format('H:i:s'),
                'actual_end_time' => null,
                'expected_work_minutes' => $expectedWorkMinutes,
                'actual_work_minutes' => 0, 'productive_work_minutes' => 0,
                'status' => 'auto_finalized',
                'notes' => $stillWorking
                    ? 'Baru ada scan masuk — kemungkinan masih bekerja.'
                    : 'Hanya ada 1 scan — pulang tidak terekam. Perlu resolusi manual HRD.',
            ]);
        }

        // Kerja di hari libur terjadwal: expectedStart = null DAN expectedWorkMinutes = 0.
        // PENTING: Format A (target_minutes) juga punya expectedStart = null tapi expectedWorkMinutes > 0
        // → JANGAN dianggap libur, lanjutkan ke kalkulasi normal di bawah.
        if (! $expectedStart && $expectedWorkMinutes === 0) {
            $holidayMinutes = abs($actualEnd->diffInMinutes($actualStart));
            return $this->upsert($employeeId, $employee->company_id, $date, [
                'attendance_status' => 'present',
                'actual_start_time' => $actualStart->format('H:i:s'),
                'actual_end_time' => $actualEnd->format('H:i:s'),
                'expected_work_minutes' => 0,
                'actual_work_minutes' => $holidayMinutes,
                'productive_work_minutes' => $holidayMinutes,
                'overtime_minutes' => $holidayMinutes,
                'overtime_verified' => $holidayMinutes > 0 ? $this->hasApprovedOvertime($employeeId, $date) : null,
                'shift_type' => 'holiday',
                'status' => 'auto_finalized',
            ]);
        }

        // --- Kalkulasi durasi aktual ---
        $actualWorkMinutes = abs($actualEnd->diffInMinutes($actualStart));

        // --- BRANCHING KONDISI 1 / 2 / 3 ---
        $diff = $actualWorkMinutes - $expectedWorkMinutes;

        $overtimeMinutes = 0;
        $undertimeMinutes = 0;
        $overtimeVerified = null;
        $earlyLeaveMinutes = 0;

        if ($diff >= $overtimeThreshold) {
            // Kondisi 3: Durasi Lebih (Overtime)
            // Lembur = durasi_aktual - target (selisih penuh, threshold hanya sebagai gate).
            $overtimeMinutes = $diff;
            $overtimeVerified = $this->hasApprovedOvertime($employeeId, $date);
        } elseif ($diff < 0) {
            // Kondisi 1: Durasi Kurang (Undertime)
            $undertimeMinutes = abs($diff);
            $earlyLeaveMinutes = $undertimeMinutes;
        }
        // Kondisi 2: 0 <= diff < threshold → kelebihan hangus, tidak dihitung lembur.

        // Hitung keterlambatan untuk referensi laporan (late_minutes tetap dicatat),
        // tapi attendance_status TIDAK diubah menjadi 'late'.
        // Perusahaan pakai multi-shift dengan jam masuk bervariasi (06:00/07:00/08:00) —
        // deteksi terlambat berbasis jam referensi global tidak akurat.
        $lateMinutes = 0;
        if ($expectedStart) {
            $expectedStartDt = Carbon::parse($date . ' ' . $expectedStart);
            $lateMinutes = $actualStart->gt($expectedStartDt) ? abs($actualStart->diffInMinutes($expectedStartDt)) : 0;
        }

        // Status kehadiran
        $attendanceStatus = 'present';

        // Pulang Cepat hanya jika BENAR-BENAR kurang dari jam kerja minimum (default 480 menit / 8 jam).
        // Jika karyawan sudah mencapai jam kerja minimum meskipun pulang sebelum jam selesai shift,
        // status tetap 'present' — perbedaan jam shift vs jam kerja aktual TIDAK dihukum.
        $minimumWorkMinutes = 480; // 8 jam = standar minimum kerja
        if ($earlyLeaveMinutes > 0 && $actualWorkMinutes < $minimumWorkMinutes) {
            $attendanceStatus = 'early_leave';
        }

        return $this->upsert($employeeId, $employee->company_id, $date, [
            'attendance_status' => $attendanceStatus,
            'expected_start_time' => $expectedStart, 'expected_end_time' => $expectedEnd,
            'actual_start_time' => $actualStart->format('H:i:s'),
            'actual_end_time' => $actualEnd->format('H:i:s'),
            'late_minutes' => $lateMinutes,
            'early_leave_minutes' => $earlyLeaveMinutes,
            'expected_work_minutes' => $expectedWorkMinutes,
            'actual_work_minutes' => $actualWorkMinutes,
            'productive_work_minutes' => $actualWorkMinutes,
            'overtime_minutes' => $overtimeMinutes,
            'overtime_verified' => $overtimeVerified,
            'undertime_minutes' => $undertimeMinutes,
            'shift_type' => 'regular',
            'status' => 'auto_finalized',
        ]);
    }

    /**
     * Ambil semua log dalam satu "business date window" menggunakan cut-off time.
     *
     * Window untuk business_date $date:
     *   DARI  : $date $cutoff (mis. 2026-07-17 05:00)
     *   SAMPAI: $date+1 $cutoff - 1 menit (mis. 2026-07-18 04:59)
     *
     * Contoh konkret dengan cutoff 05:00:
     *   Scan jam 2026-07-17 01:10 → masuk window 2026-07-16 (bukan 2026-07-17)
     *   Scan jam 2026-07-17 07:55 → masuk window 2026-07-17 ✓
     *   Scan jam 2026-07-18 01:10 → masuk window 2026-07-17 ✓ (shift malam)
     *   Scan jam 2026-07-18 05:00 → masuk window 2026-07-18 (bukan 2026-07-17)
     */
    protected function getLogsForBusinessDate(string $employeeId, string $date, string $cutoff = '05:00'): \Illuminate\Support\Collection
    {
        [$ch, $cm] = array_map('intval', explode(':', $cutoff));

        $windowStart = Carbon::parse($date)->setHour($ch)->setMinute($cm)->setSecond(0);
        $windowEnd = $windowStart->copy()->addDay()->subSecond(); // $date+1 cutoff - 1 detik

        return AttendanceLog::where('employee_id', $employeeId)
            ->whereBetween('logged_time', [$windowStart, $windowEnd])
            ->orderBy('logged_time')
            ->get(['log_type', 'logged_time']);
    }

    /**
     * Resolve target kerja untuk karyawan pada tanggal tertentu.
     *
     * daily_hours_override mendukung 2 format:
     *   A. { "6": { "target_minutes": 300 } }        ← PURE DURATION (direkomendasikan)
     *      Tidak ada deteksi terlambat. Hanya bandingkan durasi aktual vs target menit.
     *      Cocok untuk perusahaan yang tidak ketat soal jam datang, hanya total durasi kerja.
     *
     *   B. { "6": { "start_time": "07:00", "end_time": "12:00" } }  ← dengan referensi waktu
     *      Ada deteksi terlambat (masuk setelah work_start + toleransi → late).
     *      Target menit dihitung otomatis dari selisih start_time dan end_time.
     *
     * Kalau hari tidak ada override: gunakan setting global perusahaan (format B).
     *
     * @return [?string startTime, ?string endTime, int targetMinutes, int overtimeThreshold, string cutoff]
     *   startTime=null → skip deteksi terlambat (pure duration mode)
     */
    protected function resolveExpectedShift(Employee $employee, string $date): array
    {
        $employeeShift = EmployeeShift::where('employee_id', $employee->id)
            ->where('status', 'active')
            ->where('start_date', '<=', $date)
            ->where(fn ($q) => $q->whereNull('end_date')->orWhere('end_date', '>=', $date))
            ->with('shift')
            ->first();

        if ($employeeShift?->shift) {
            $shift = $employeeShift->shift;
            $companySetting = CompanyWorkSetting::where('company_id', $employee->company_id)
                ->where('effective_date', '<=', $date)->orderByDesc('effective_date')->first();
            return [
                $shift->start_time, $shift->end_time, $shift->total_work_minutes,
                $companySetting?->overtime_min_minutes ?? 60,
                $companySetting?->business_date_cutoff ?? '05:00',
            ];
        }

        $setting = CompanyWorkSetting::where('company_id', $employee->company_id)
            ->where('effective_date', '<=', $date)
            ->orderByDesc('effective_date')
            ->first();

        $cutoff = $setting?->business_date_cutoff ?? '05:00';
        $threshold = $setting?->overtime_min_minutes ?? 60;

        if (! $setting) return [null, null, 0, $threshold, $cutoff];

        // Cek apakah hari ini hari kerja menurut work_days.
        $dayOfWeek = Carbon::parse($date)->dayOfWeekIso; // 1=Senin .. 7=Minggu
        $workDays = $setting->work_days ?? [1, 1, 1, 1, 1, 1, 0];
        if (empty($workDays[$dayOfWeek - 1])) return [null, null, 0, $threshold, $cutoff];

        $override = ($setting->daily_hours_override ?? [])[(string) $dayOfWeek] ?? null;

        // Format A: target_minutes — pure duration, skip deteksi terlambat (startTime=null)
        if (isset($override['target_minutes'])) {
            return [null, null, (int) $override['target_minutes'], $threshold, $cutoff];
        }

        // Format B: start_time/end_time override per hari
        if (isset($override['start_time'], $override['end_time'])) {
            $minutes = abs(Carbon::parse($override['end_time'])->diffInMinutes(Carbon::parse($override['start_time'])));
            return [$override['start_time'], $override['end_time'], max(0, $minutes), $threshold, $cutoff];
        }

        // Default: pakai jam global perusahaan (ada referensi waktu → bisa deteksi terlambat)
        $minutes = abs(Carbon::parse($setting->work_end_time)->diffInMinutes(Carbon::parse($setting->work_start_time)));
        return [$setting->work_start_time, $setting->work_end_time, max(0, $minutes), $threshold, $cutoff];
    }

    protected function isOnApprovedLeave(string $employeeId, string $date): bool
    {
        // Skema baru: leave_date = tanggal tunggal (bukan range start_date/end_date)
        return LeaveRequest::where('employee_id', $employeeId)
            ->where('status', 'approved')
            ->where('leave_type', 'not_present')   // hanya izin tidak masuk yang mempengaruhi status hadir
            ->whereDate('leave_date', $date)
            ->exists();
    }

    protected function hasApprovedOvertime(string $employeeId, string $date): bool
    {
        return OvertimeRequestDetail::whereHas('overtimeRequest', function ($q) use ($date) {
            $q->where('overtime_date', $date)->where('status', 'approved');
        })->where('employee_id', $employeeId)->where('status', 'approved')->exists();
    }

    protected function upsert(string $employeeId, string $companyId, string $date, array $attrs): AttendanceSummary
    {
        return AttendanceSummary::updateOrCreate(
            ['employee_id' => $employeeId, 'attendance_date' => $date],
            $attrs + ['company_id' => $companyId]
        );
    }
}
