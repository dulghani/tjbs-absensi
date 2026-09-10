<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkDayException;
use Illuminate\Http\Request;

class WorkDayExceptionController extends Controller
{
    /** Daftar pengecualian per perusahaan, filter by tahun/bulan opsional. */
    public function index(Request $request, string $companyId)
    {
        $query = WorkDayException::where('company_id', $companyId)
            ->orderBy('exception_date');

        if ($request->year)  $query->whereYear('exception_date', $request->year);
        if ($request->month) $query->whereMonth('exception_date', $request->month);

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request, string $companyId)
    {
        $data = $request->validate([
            'exception_date'  => 'required|date',
            'exception_type'  => 'required|in:holiday,replacement_day,half_day',
            'replaces_date'   => 'nullable|date',
            'half_day_minutes'=> 'nullable|integer|min:30|max:480',
            'description'     => 'nullable|string|max:255',
        ]);

        $exception = WorkDayException::create([
            ...$data,
            'company_id' => $companyId,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $exception], 201);
    }

    public function update(Request $request, string $companyId, string $id)
    {
        $exception = WorkDayException::where('company_id', $companyId)->findOrFail($id);

        $data = $request->validate([
            'exception_date'  => 'sometimes|date',
            'exception_type'  => 'sometimes|in:holiday,replacement_day,half_day',
            'replaces_date'   => 'nullable|date',
            'half_day_minutes'=> 'nullable|integer|min:30|max:480',
            'description'     => 'nullable|string|max:255',
        ]);

        $exception->update($data);
        return response()->json(['data' => $exception]);
    }

    public function destroy(string $companyId, string $id)
    {
        WorkDayException::where('company_id', $companyId)->findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }
}
