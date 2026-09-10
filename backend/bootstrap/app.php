<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // CATATAN: kita SENGAJA tidak pakai EnsureFrontendRequestsAreStateful di sini.
        // Frontend React kita autentikasi pakai Bearer token (personal access token
        // dari Sanctum), bukan cookie/session. Middleware itu untuk pola SPA berbasis
        // cookie yang butuh CSRF token — kalau dipasang, akan muncul error
        // "CSRF token mismatch" karena frontend tidak pernah fetch /sanctum/csrf-cookie.
        // Route API kita sudah aman lewat middleware('auth:sanctum') per-route di routes/api.php.
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
