<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use App\Models\ShiftPattern;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    public function index(string $companyId)
    {
        return response()->json(['data' => Shift::where('company_id', $companyId)->orderBy('start_time')->get()]);
    }

    public function store(Request $request, string $companyId)
    {
        $data = $request->validate([
            'code' => 'required|string|max:30',
            'name' => 'required|string|max:255',
            'start_time' => 'required',
            'end_time' => 'required',
            'break_duration_minutes' => 'nullable|integer|min:0',
            'is_night_shift' => 'nullable|boolean',
            'color_code' => 'nullable|string|max:7',
        ]);

        $shift = Shift::create($data + ['company_id' => $companyId, 'status' => 'active']);
        return response()->json(['data' => $shift], 201);
    }

    public function update(Request $request, string $id)
    {
        $shift = Shift::findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'start_time' => 'sometimes',
            'end_time' => 'sometimes',
            'break_duration_minutes' => 'nullable|integer|min:0',
            'is_night_shift' => 'nullable|boolean',
            'status' => 'nullable|in:active,inactive',
        ]);
        $shift->update($data);
        return response()->json(['data' => $shift]);
    }

    public function destroy(string $id)
    {
        Shift::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    public function patterns(string $companyId)
    {
        return response()->json(['data' => ShiftPattern::where('company_id', $companyId)->with('details.shift')->get()]);
    }

    public function storePattern(Request $request, string $companyId)
    {
        $data = $request->validate([
            'code' => 'required|string|max:30',
            'name' => 'required|string|max:255',
            'pattern_length' => 'required|integer|min:1',
        ]);
        $pattern = ShiftPattern::create($data + ['company_id' => $companyId, 'status' => 'active']);
        return response()->json(['data' => $pattern], 201);
    }
}
