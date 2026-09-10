<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ManualDeduction;
use App\Models\Employee;
use Illuminate\Http\Request;

class ManualDeductionController extends Controller
{
    public function index(Request $request)
    {
        $query = ManualDeduction::with('employee:id,name,nik,department')
            ->orderBy('period_year', 'desc')->orderBy('period_month', 'desc')->orderBy('created_at', 'desc');

        if ($request->company_id && $request->company_id !== 'all')
            $query->where('company_id', $request->company_id);
        if ($request->period_month) $query->where('period_month', $request->period_month);
        if ($request->period_year)  $query->where('period_year', $request->period_year);
        if ($request->employee_id)  $query->where('employee_id', $request->employee_id);
        if ($request->status && $request->status !== 'all')
            $query->where('status', $request->status);

        return response()->json(['data' => $query->paginate($request->per_page ?? 25)]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'company_id'   => 'required|uuid|exists:companies,id',
            'employee_id'  => 'required|uuid|exists:employees,id',
            'period_month' => 'required|integer|min:1|max:12',
            'period_year'  => 'required|integer|min:2020',
            'description'  => 'required|string|max:255',
            'type'         => 'required|in:kasbon,cicilan,denda,keterlambatan,kerusakan,other',
            'amount'       => 'required|numeric|min:0',
            'notes'        => 'nullable|string|max:1000',
        ]);

        $deduction = ManualDeduction::create($data + [
            'status'     => 'active',
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $deduction->load('employee:id,name,nik,department')], 201);
    }

    public function update(Request $request, string $id)
    {
        $deduction = ManualDeduction::findOrFail($id);
        $data = $request->validate([
            'description' => 'sometimes|string|max:255',
            'type'        => 'sometimes|in:kasbon,cicilan,denda,keterlambatan,kerusakan,other',
            'amount'      => 'sometimes|numeric|min:0',
            'notes'       => 'nullable|string|max:1000',
            'status'      => 'sometimes|in:active,cancelled',
        ]);
        $deduction->update($data);
        return response()->json(['data' => $deduction->load('employee:id,name,nik,department')]);
    }

    public function destroy(string $id)
    {
        ManualDeduction::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /** Summary total potongan manual per karyawan dalam periode */
    public function summary(Request $request)
    {
        $request->validate([
            'company_id'   => 'required|uuid',
            'period_month' => 'required|integer',
            'period_year'  => 'required|integer',
        ]);

        $rows = ManualDeduction::with('employee:id,name,nik,department')
            ->where('company_id', $request->company_id)
            ->where('period_month', $request->period_month)
            ->where('period_year', $request->period_year)
            ->where('status', 'active')
            ->selectRaw('employee_id, SUM(amount) as total_amount')
            ->groupBy('employee_id')
            ->get();

        return response()->json(['data' => $rows]);
    }
}
