<?php

use Illuminate\Support\Facades\Schedule;

// ── Sync otomatis mesin Fingerspot ────────────────────────────────────────────
// Tiap menit: cek apakah ada device yang sudah waktunya sync (berdasarkan interval).
// Sync dijalankan LANGSUNG (sinkron) — tidak butuh queue:work.
Schedule::command('attendance:sync-check')
    ->everyMinute()
    ->withoutOverlapping(5)
    ->runInBackground();   // jalan di background process PHP, tidak block scheduler

// Setiap jam 00:30 dan 06:30: sync hari kemarin (menangkap shift malam)
Schedule::command('attendance:sync-check')
    ->twiceDaily(0, 6)
    ->withoutOverlapping(10);
