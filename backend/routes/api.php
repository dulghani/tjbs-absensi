<?php

use App\Http\Controllers\Api\AppSettingController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AttendanceDeviceController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\LeaveController;
use App\Http\Controllers\Api\ManualDeductionController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\OvertimeController;
use App\Http\Controllers\Api\PayrollController;
use App\Http\Controllers\Api\ReportsController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// ── Public ────────────────────────────────────────────────────────────────────
Route::post('/auth/login', [AuthController::class, 'login']);
Route::get('/app-settings', [AppSettingController::class, 'index']); // publik — frontend pakai ini

// ── Protected (butuh token Sanctum) ──────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::post('/app-settings', [AppSettingController::class, 'update']);
    Route::get('/dashboard/monitoring', [DashboardController::class, 'monitoring']);
    Route::get('/dashboard/chart-weekly', [DashboardController::class, 'chartWeekly']);
    Route::get('/dashboard/indisipliner', [DashboardController::class, 'indisipliner']);
    Route::get('/dashboard/belum-lengkap', [DashboardController::class, 'belumLengkap']);
    Route::get('/dashboard/kalender', [DashboardController::class, 'kalender']);

    // Organisasi (Modul 1)
    Route::prefix('organizations')->group(function () {
        Route::get('/companies', [OrganizationController::class, 'companies']);
        Route::post('/companies', [OrganizationController::class, 'storeCompany']);
        Route::get('/companies/{id}', [OrganizationController::class, 'showCompany']);
        Route::patch('/companies/{id}', [OrganizationController::class, 'updateCompany']);
        Route::patch('/companies/{id}/toggle-status', [OrganizationController::class, 'toggleCompanyStatus']);
        Route::get('/companies/{id}/tree', [OrganizationController::class, 'tree']);

        Route::get('/divisions', [OrganizationController::class, 'allDivisions']);
        Route::get('/companies/{companyId}/divisions', [OrganizationController::class, 'divisions']);
        Route::post('/companies/{companyId}/divisions', [OrganizationController::class, 'storeDivision']);
        Route::delete('/divisions/{id}', [OrganizationController::class, 'deleteDivision']);

        Route::get('/companies/{companyId}/departments', [OrganizationController::class, 'departments']);
        Route::post('/companies/{companyId}/departments', [OrganizationController::class, 'storeDepartment']);
        Route::delete('/departments/{id}', [OrganizationController::class, 'deleteDepartment']);

        Route::get('/departments/{departmentId}/sections', [OrganizationController::class, 'sections']);
        Route::post('/departments/{departmentId}/sections', [OrganizationController::class, 'storeSection']);

        Route::get('/sections/{sectionId}/lines', [OrganizationController::class, 'lines']);
        Route::post('/sections/{sectionId}/lines', [OrganizationController::class, 'storeLine']);
    });

    // Karyawan
    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::get('/employees/departments', [EmployeeController::class, 'departments']);
    Route::get('/employees/divisions', [EmployeeController::class, 'divisionList']);
    Route::get('/employees/search', [EmployeeController::class, 'search']);
    Route::get('/employees/export', [EmployeeController::class, 'export']);
    Route::get('/employees/template', [EmployeeController::class, 'downloadTemplate']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::delete('/employees/bulk-delete', [EmployeeController::class, 'bulkDestroy']);
    Route::patch('/employees/{id}/toggle-status', [EmployeeController::class, 'toggleStatus']);
    Route::post('/employees/import', [AttendanceDeviceController::class, 'importGlobal']);
    Route::get('/employees/{id}', [EmployeeController::class, 'show']);
    Route::patch('/employees/{id}', [EmployeeController::class, 'update']);
    Route::delete('/employees/{id}', [EmployeeController::class, 'destroy']);

    // Shift Management (Modul 2)
    Route::prefix('shifts')->group(function () {
        Route::get('/companies/{companyId}/shifts', [ShiftController::class, 'index']);
        Route::post('/companies/{companyId}/shifts', [ShiftController::class, 'store']);
        Route::patch('/{id}', [ShiftController::class, 'update']);
        Route::delete('/{id}', [ShiftController::class, 'destroy']);
        Route::get('/companies/{companyId}/patterns', [ShiftController::class, 'patterns']);
        Route::post('/companies/{companyId}/patterns', [ShiftController::class, 'storePattern']);
    });

    // Kalender Pengecualian (Libur Nasional, Ganti Hari, Setengah Hari)
    Route::prefix('companies/{companyId}/work-exceptions')->group(function () {
        Route::get('/',       [\App\Http\Controllers\Api\WorkDayExceptionController::class, 'index']);
        Route::post('/',      [\App\Http\Controllers\Api\WorkDayExceptionController::class, 'store']);
        Route::patch('/{id}', [\App\Http\Controllers\Api\WorkDayExceptionController::class, 'update']);
        Route::delete('/{id}',[\App\Http\Controllers\Api\WorkDayExceptionController::class, 'destroy']);
    });

    // Attendance Engine (Modul 3)
    Route::prefix('attendance')->group(function () {
        Route::post('/check-in', [AttendanceController::class, 'checkIn']);
        Route::post('/check-out', [AttendanceController::class, 'checkOut']);
        Route::post('/recalculate', [AttendanceController::class, 'recalculate']);
        Route::get('/summaries/{employeeId}', [AttendanceController::class, 'summaries']);
        Route::get('/summaries', [AttendanceController::class, 'summaries']);
        Route::get('/summary-stats', [AttendanceController::class, 'summaryStats']);
        Route::get('/daily/{employeeId}/{date}', [AttendanceController::class, 'daily']);
        Route::get('/analytics/{employeeId}/{month}/{year}', [AttendanceController::class, 'analytics']);
        Route::post('/summaries/{summaryId}/resolve', [AttendanceController::class, 'resolveIncomplete']);
        Route::post('/summaries/batch-resolve', [AttendanceController::class, 'batchResolveIncomplete']);
        Route::get('/export', [AttendanceController::class, 'exportAttendance']);
    });
    Route::prefix('leave')->group(function () {
        Route::get('/companies/{companyId}/types', [AttendanceController::class, 'leaveTypes']);
        Route::post('/requests', [AttendanceController::class, 'storeLeaveRequest']);
        Route::patch('/requests/{id}/approve', [AttendanceController::class, 'approveLeaveRequest']);
    });

    // Integrasi Mesin Absensi (Fingerspot)
    Route::prefix('attendance-devices')->group(function () {
        Route::get('/', [AttendanceDeviceController::class, 'index']);
        Route::post('/', [AttendanceDeviceController::class, 'store']);
        Route::patch('/{id}', [AttendanceDeviceController::class, 'update']);
        Route::delete('/{id}', [AttendanceDeviceController::class, 'destroy']);
        Route::post('/{id}/test-connection', [AttendanceDeviceController::class, 'testConnection']);
        Route::post('/{id}/sync-now', [AttendanceDeviceController::class, 'syncNow']);
        Route::get('/{id}/sync-logs', [AttendanceDeviceController::class, 'syncLogs']);
        Route::get('/{id}/sync-coverage', [AttendanceDeviceController::class, 'syncCoverage']);
        Route::get('/{id}/mappings', [AttendanceDeviceController::class, 'mappings']);
        Route::post('/{id}/mappings', [AttendanceDeviceController::class, 'addMapping']);
        Route::delete('/{id}/mappings/{mappingId}', [AttendanceDeviceController::class, 'removeMapping']);
        Route::post('/{id}/import-employees', [AttendanceDeviceController::class, 'importEmployees']);
        Route::post('/{id}/sync-employees-api', [AttendanceDeviceController::class, 'syncEmployeesFromApi']);
        Route::post('/{id}/create-employees-from-logs', [AttendanceDeviceController::class, 'createEmployeesFromLogs']);
    });

    // Lembur (multi-item)
    Route::prefix('overtime')->group(function () {
        Route::get('/', [OvertimeController::class, 'index']);
        Route::post('/', [OvertimeController::class, 'store']);
        Route::get('/{id}', [OvertimeController::class, 'show']);
        Route::delete('/{id}', [OvertimeController::class, 'destroy']);
        Route::post('/{id}/approve-all', [OvertimeController::class, 'approveAll']);
        Route::post('/{requestId}/items/{itemId}/approve', [OvertimeController::class, 'approveItem']);
        Route::post('/{requestId}/items/{itemId}/reject', [OvertimeController::class, 'rejectItem']);
    });

    // Payroll & Aturan Kerja
    Route::prefix('payroll')->group(function () {        Route::get('/', [PayrollController::class, 'index']);
        Route::post('/process', [PayrollController::class, 'process']);
        Route::get('/{id}', [PayrollController::class, 'show']);
        Route::post('/{id}/finalize', [PayrollController::class, 'finalize']);
        Route::post('/{id}/recalculate', [PayrollController::class, 'recalculate']);
        Route::delete('/{id}', [PayrollController::class, 'destroy']);
        Route::patch('/{id}/detail/{employeeId}', [PayrollController::class, 'updateDetail']);
        Route::get('/work-settings/{companyId}', [PayrollController::class, 'getWorkSettings']);
        Route::patch('/work-settings/{companyId}', [PayrollController::class, 'updateWorkSettings']);
        Route::get('/components/{companyId}', [PayrollController::class, 'salaryComponents']);
        Route::post('/components', [PayrollController::class, 'storeSalaryComponent']);
        Route::patch('/components/{id}', [PayrollController::class, 'updateSalaryComponent']);
        Route::delete('/components/{id}', [PayrollController::class, 'deleteSalaryComponent']);
        Route::get('/overtime-rates/{companyId}', [PayrollController::class, 'overtimeRates']);
        Route::post('/overtime-rates', [PayrollController::class, 'storeOvertimeRate']);
        Route::patch('/overtime-rates/{id}', [PayrollController::class, 'updateOvertimeRate']);
        Route::delete('/overtime-rates/{id}', [PayrollController::class, 'deleteOvertimeRate']);
        Route::get('/effective-work-days/{companyId}', [PayrollController::class, 'effectiveWorkDays']);
        Route::post('/effective-work-days', [PayrollController::class, 'storeEffectiveWorkDays']);
        Route::delete('/effective-work-days/{id}', [PayrollController::class, 'deleteEffectiveWorkDays']);
    });

    // Izin Karyawan
    Route::prefix('leave')->group(function () {
        Route::get('/', [LeaveController::class, 'index']);
        Route::post('/', [LeaveController::class, 'store']);
        Route::post('/{id}/approve', [LeaveController::class, 'approve']);
        Route::post('/{id}/reject', [LeaveController::class, 'reject']);
        Route::delete('/{id}', [LeaveController::class, 'destroy']);
    });

    // Potongan Manual
    Route::prefix('manual-deductions')->group(function () {        Route::get('/', [ManualDeductionController::class, 'index']);
        Route::post('/', [ManualDeductionController::class, 'store']);
        Route::patch('/{id}', [ManualDeductionController::class, 'update']);
        Route::delete('/{id}', [ManualDeductionController::class, 'destroy']);
        Route::get('/summary', [ManualDeductionController::class, 'summary']);
    });

    // Dokumen (Modul 5)
    Route::prefix('documents')->group(function () {
        Route::get('/', [DocumentController::class, 'index']);
        Route::post('/', [DocumentController::class, 'store']);
        Route::get('/{id}', [DocumentController::class, 'show']);
        Route::post('/{id}/acknowledge', [DocumentController::class, 'acknowledge']);
        Route::get('/categories/{companyId}', [DocumentController::class, 'categories']);
        Route::post('/categories', [DocumentController::class, 'storeCategory']);
    });

    // Notifikasi & Approval Center (Modul 6)
    Route::get('/notifications/me', [NotificationController::class, 'myNotifications']);
    Route::post('/notifications/{id}/mark-read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
    Route::get('/approval-center/pending', [NotificationController::class, 'approvalCenterPending']);
    Route::get('/approval-center/history', [NotificationController::class, 'approvalCenterHistory']);

    // Manajemen User
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::patch('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);
    Route::post('/users/{id}/reset-password', [UserController::class, 'resetPassword']);

    // Audit Log (Modul 7)
    Route::prefix('audit-logs')->group(function () {
        Route::get('/', [AuditController::class, 'index']);
        Route::get('/{id}', [AuditController::class, 'show']);
        Route::get('/reports/user-activity/{userId}', [AuditController::class, 'userActivity']);
        Route::get('/reports/attendance-summary', [ReportsController::class, 'attendanceSummary']);
        Route::get('/reports/attendance-detail', [ReportsController::class, 'attendanceDetail']);
        Route::get('/reports/attendance-harian', [ReportsController::class, 'rekapHarian']);
        Route::get('/reports/attendance-harian/export', [ReportsController::class, 'exportRekapHarian']);
        Route::get('/reports/overtime-summary', [ReportsController::class, 'overtimeSummary']);
        Route::get('/reports/payroll/{payrollId}/slips', [ReportsController::class, 'payrollSlips']);
        Route::get('/reports/payroll/{payrollId}/slip/{employeeId}', [ReportsController::class, 'payrollSlip']);
        Route::get('/reports/payroll/{payrollId}/export-gaji', [ReportsController::class, 'exportGaji']);
    });
});
