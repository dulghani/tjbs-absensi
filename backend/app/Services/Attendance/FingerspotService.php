<?php

namespace App\Services\Attendance;

use App\Exceptions\FingerspotException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Client untuk Fingerspot Cloud API.
 *
 * Setiap request butuh signature MD5 dari (cloud_id + parameter + waktu_saat_ini +
 * api_key), dan berlaku hanya beberapa detik sehingga signature harus dibuat ulang
 * setiap kali request dikirim (tidak bisa di-cache).
 *
 * Docs resmi: https://fingerspot.io/documentation
 */
class FingerspotService
{
    protected string $baseUrl = 'https://api.fingerspot.io/api';

    public function __construct(
        protected string $cloudId,
        protected string $apiKey,
    ) {}

    /**
     * Ambil log absensi mentah (raw punch) untuk satu tanggal.
     *
     * @param  string $date  Format Y-m-d (2025-07-10)
     * @return array<int, array<string, mixed>>
     * @throws FingerspotException
     */
    public function fetchAttendanceLog(string $date, array $options = []): array
    {
        $formatDate = $options['format_date'] ?? '6';
        $property   = $options['property']    ?? 'date_time';
        $direction  = $options['direction']   ?? 'asc';
        $exportType = $options['export_type'] ?? 'json';

        $currentTime = now()->format('YmdHis');
        $auth = $this->generateAuth($date, $currentTime);

        $url = sprintf(
            '%s/download/attendance_log/%s/%s/%s/%s/%s/%s/%s/%s',
            $this->baseUrl, $this->cloudId, $date, $formatDate, $property, $direction, $exportType, $auth, $currentTime,
        );

        try {
            $response = Http::withOptions(['verify' => false])
                ->timeout(30)
                ->retry(2, 500)
                ->get($url);
        } catch (Throwable $e) {
            Log::warning('Fingerspot: koneksi gagal', ['cloud_id' => $this->cloudId, 'error' => $e->getMessage()]);
            throw new FingerspotException("Tidak bisa terhubung ke Fingerspot: {$e->getMessage()}");
        }

        if (! $response->successful()) {
            throw new FingerspotException("Fingerspot merespons HTTP {$response->status()}");
        }

        $data = $response->json();

        if (! is_array($data)) {
            throw new FingerspotException('Response Fingerspot bukan JSON yang valid');
        }

        if (array_key_exists('success', $data) && $data['success'] === false) {
            throw new FingerspotException($data['message'] ?? 'Fingerspot mengembalikan status gagal');
        }

        return $data['data'] ?? (is_array($data) ? $data : []);
    }

    /** Ambil log untuk rentang tanggal (loop harian). */
    public function fetchAttendanceLogRange(string $startDate, string $endDate): array
    {
        $all = [];
        $cursor = \Carbon\Carbon::parse($startDate);
        $end = \Carbon\Carbon::parse($endDate);

        while ($cursor->lte($end)) {
            try {
                $all = array_merge($all, $this->fetchAttendanceLog($cursor->format('Y-m-d')));
            } catch (FingerspotException $e) {
                Log::warning("Fingerspot: gagal ambil log {$cursor->format('Y-m-d')}: {$e->getMessage()}");
            }
            $cursor->addDay();
        }

        return $all;
    }

    public function testConnection(): array
    {
        try {
            $records = $this->fetchAttendanceLog(now()->format('Y-m-d'));
            return ['success' => true, 'message' => 'Koneksi berhasil', 'record_count_today' => count($records)];
        } catch (FingerspotException $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Ambil daftar karyawan dari Fingerspot Cloud API.
     *
     * Endpoint: /api/download/users/{cloud_id}/{export_type}/{auth}/{timestamp}
     * Response berisi data karyawan yang terdaftar di mesin fingerprint:
     *   PIN (ID mesin), name, department, dll.
     *
     * @return array<int, array<string, mixed>>
     * @throws FingerspotException
     */
    public function fetchEmployees(): array
    {
        $currentTime = now()->format('YmdHis');
        // Auth untuk user list menggunakan "user" sebagai parameter (bukan tanggal)
        $auth = md5($this->cloudId . 'user' . $currentTime . $this->apiKey);

        $url = sprintf(
            '%s/download/users/%s/json/%s/%s',
            $this->baseUrl, $this->cloudId, $auth, $currentTime,
        );

        try {
            $response = Http::withOptions(['verify' => false])
                ->timeout(30)
                ->retry(2, 500)
                ->get($url);
        } catch (Throwable $e) {
            throw new FingerspotException("Tidak bisa terhubung ke Fingerspot: {$e->getMessage()}");
        }

        if (! $response->successful()) {
            throw new FingerspotException("Fingerspot merespons HTTP {$response->status()}");
        }

        $data = $response->json();

        if (! is_array($data)) {
            throw new FingerspotException('Response Fingerspot bukan JSON yang valid');
        }

        if (isset($data['success']) && $data['success'] === false) {
            throw new FingerspotException($data['message'] ?? 'Fingerspot mengembalikan status gagal');
        }

        return $data['data'] ?? (is_array($data) ? $data : []);
    }

    protected function generateAuth(string $param, string $currentTime): string
    {
        return md5($this->cloudId . $param . $currentTime . $this->apiKey);
    }
}
