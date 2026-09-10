<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Department;
use App\Models\Division;
use App\Models\ProductionLine;
use App\Models\Section;
use Illuminate\Http\Request;

class OrganizationController extends Controller
{
    // ── Companies ─────────────────────────────────────────────────────────────
    public function companies(Request $request)
    {
        $companies = Company::withCount('employees')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $companies]);
    }

    public function showCompany(string $id)
    {
        return response()->json(['data' => Company::findOrFail($id)]);
    }

    public function storeCompany(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string|max:20|unique:companies,code',
            'name' => 'required|string|max:255',
            'npwp' => 'nullable|string|max:30',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email',
            'pic_name' => 'nullable|string|max:255',
            'pic_phone' => 'nullable|string|max:30',
        ]);

        $company = Company::create($data + ['status' => 'active']);
        AuditLog::record(['company_id' => $company->id, 'action_category' => 'create', 'entity_type' => 'company', 'entity_id' => $company->id, 'entity_name' => $company->name, 'changes_summary' => 'Membuat perusahaan baru']);

        return response()->json(['data' => $company], 201);
    }

    public function updateCompany(Request $request, string $id)
    {
        $company = Company::findOrFail($id);
        $old = $company->only(array_keys($request->all()));

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'npwp' => 'nullable|string|max:30',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email',
            'pic_name' => 'nullable|string|max:255',
            'pic_phone' => 'nullable|string|max:30',
            'status' => 'nullable|in:active,inactive,suspended',
        ]);

        $company->update($data);
        AuditLog::record(['company_id' => $company->id, 'action_category' => 'update', 'entity_type' => 'company', 'entity_id' => $company->id, 'entity_name' => $company->name, 'old_values' => $old, 'new_values' => $data]);

        return response()->json(['data' => $company]);
    }

    public function toggleCompanyStatus(string $id)
    {
        $company = Company::findOrFail($id);
        $newStatus = $company->status === 'active' ? 'inactive' : 'active';
        $company->update(['status' => $newStatus]);
        AuditLog::record(['company_id' => $company->id, 'action_category' => 'update', 'entity_type' => 'company', 'entity_id' => $company->id, 'entity_name' => $company->name, 'changes_summary' => "Status diubah ke {$newStatus}"]);
        return response()->json(['data' => $company, 'message' => $newStatus === 'active' ? 'Perusahaan diaktifkan.' : 'Perusahaan dinonaktifkan.']);
    }

    public function tree(string $id)
    {
        $company = Company::findOrFail($id);

        $divisions = Division::where('company_id', $id)->with([
            'departments' => fn ($q) => $q->with([
                'sections' => fn ($q2) => $q2->with('lines'),
            ]),
        ])->get();

        return response()->json([
            'id' => $company->id, 'name' => $company->name, 'type' => 'company',
            'children' => $divisions->map(fn ($div) => [
                'id' => $div->id, 'name' => $div->name, 'type' => 'division',
                'children' => $div->departments->map(fn ($dept) => [
                    'id' => $dept->id, 'name' => $dept->name, 'type' => 'department',
                    'children' => $dept->sections->map(fn ($sec) => [
                        'id' => $sec->id, 'name' => $sec->name, 'type' => 'section',
                        'children' => $sec->lines->map(fn ($line) => [
                            'id' => $line->id, 'name' => $line->name, 'type' => 'line', 'capacity' => $line->capacity,
                        ]),
                    ]),
                ]),
            ]),
        ]);
    }

    // ── Divisions ─────────────────────────────────────────────────────────────
    public function divisions(string $companyId)
    {
        return response()->json(['data' => Division::where('company_id', $companyId)->orderBy('display_order')->get()]);
    }

    public function allDivisions(Request $request)
    {
        $query = Division::query();
        if ($request->company_id && $request->company_id !== 'all') $query->where('company_id', $request->company_id);
        return response()->json(['data' => $query->orderBy('display_order')->get()]);  
    }

    public function storeDivision(Request $request, string $companyId)
    {
        $data = $request->validate(['code' => 'required|string|max:30', 'name' => 'required|string|max:255']);
        $division = Division::create($data + ['company_id' => $companyId, 'status' => 'active']);
        return response()->json(['data' => $division], 201);
    }

    // ── Departments ───────────────────────────────────────────────────────────
    public function departments(Request $request, string $companyId)
    {
        $query = Department::where('company_id', $companyId);
        if ($request->division_id) $query->where('division_id', $request->division_id);
        return response()->json(['data' => $query->orderBy('display_order')->get()]);
    }

    public function storeDepartment(Request $request, string $companyId)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:255',
            'division_id' => 'nullable|uuid|exists:divisions,id',
            'code'        => 'nullable|string|max:30',
        ]);

        // Auto-generate code unik dalam divisi kalau tidak diisi manual
        // Format: nama uppercase strip spasi, mis. "ITE" atau "BLANKING"
        // Kalau sudah ada di divisi yang sama → tambah suffix angka
        $basecode = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $data['name']), 0, 20));
        $code = $data['code'] ?? $basecode;

        if ($data['division_id']) {
            $exists = Department::where('division_id', $data['division_id'])->where('code', $code)->exists();
            if ($exists) $code = $code . '-' . substr(uniqid(), -4);
        }

        $department = Department::create([
            'company_id'  => $companyId,
            'division_id' => $data['division_id'] ?? null,
            'code'        => $code,
            'name'        => $data['name'],
            'status'      => 'active',
        ]);

        return response()->json(['data' => $department], 201);
    }

    // ── Sections ──────────────────────────────────────────────────────────────
    public function sections(string $departmentId)
    {
        return response()->json(['data' => Section::where('department_id', $departmentId)->orderBy('display_order')->get()]);
    }

    public function storeSection(Request $request, string $departmentId)
    {
        $department = Department::findOrFail($departmentId);
        $data = $request->validate(['code' => 'required|string|max:30', 'name' => 'required|string|max:255']);
        $section = Section::create($data + ['department_id' => $departmentId, 'company_id' => $department->company_id, 'status' => 'active']);
        return response()->json(['data' => $section], 201);
    }

    // ── Delete Division / Department ──────────────────────────────────────────
    public function deleteDivision(string $id)
    {
        $div = \App\Models\Division::findOrFail($id);
        $div->delete();
        return response()->json(['success' => true]);
    }

    public function deleteDepartment(string $id)
    {
        $dept = Department::findOrFail($id);
        $dept->delete();
        return response()->json(['success' => true]);
    }

    // ── Production Lines ──────────────────────────────────────────────────────
    public function lines(string $sectionId)
    {
        return response()->json(['data' => ProductionLine::where('section_id', $sectionId)->orderBy('display_order')->get()]);
    }

    public function storeLine(Request $request, string $sectionId)
    {
        $section = Section::findOrFail($sectionId);
        $data = $request->validate(['code' => 'required|string|max:30', 'name' => 'required|string|max:255', 'capacity' => 'nullable|integer']);
        $line = ProductionLine::create($data + [
            'section_id' => $sectionId, 'department_id' => $section->department_id,
            'company_id' => $section->company_id, 'status' => 'active',
        ]);
        return response()->json(['data' => $line], 201);
    }
}
