<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentAcknowledgment;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function index(Request $request)
    {
        $query = Document::with('category:id,name')->withCount('acknowledgments');
        if ($request->company_id && $request->company_id !== 'all') $query->where('company_id', $request->company_id);
        return response()->json(['data' => $query->latest()->get()]);
    }

    public function show(string $id)
    {
        return response()->json(['data' => Document::with(['category', 'acknowledgments.employee'])->findOrFail($id)]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'category_id' => 'required|uuid|exists:document_categories,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'effective_date' => 'nullable|date',
            'requires_acknowledgment' => 'nullable|boolean',
        ]);

        $count = Document::whereYear('created_at', now()->year)->count();
        $documentNumber = 'DOC-' . now()->year . '-' . str_pad($count + 1, 3, '0', STR_PAD_LEFT);

        $document = Document::create($data + [
            'document_number' => $documentNumber,
            'created_by' => $request->user()->id,
            'current_approval_status' => 'pending_approval',
            'status' => 'active',
        ]);

        return response()->json(['data' => $document], 201);
    }

    public function acknowledge(Request $request, string $id)
    {
        $data = $request->validate(['action' => 'required|in:read,acknowledged,signed,rejected', 'action_method' => 'nullable|string']);

        $document = Document::findOrFail($id);
        $employee = \App\Models\Employee::where('company_id', $document->company_id)
            ->where('id', $request->input('employee_id', $request->user()->id))
            ->first();

        $ack = DocumentAcknowledgment::updateOrCreate(
            ['document_id' => $id, 'employee_id' => $employee?->id ?? $request->user()->id],
            [
                'company_id' => $document->company_id,
                'action' => $data['action'],
                'action_date' => now(),
                'action_method' => $data['action_method'] ?? 'checkbox',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]
        );

        return response()->json(['data' => $ack], 201);
    }

    public function categories(string $companyId)
    {
        return response()->json(['data' => \App\Models\DocumentCategory::where('company_id', $companyId)->get()]);
    }

    public function storeCategory(Request $request)
    {
        $data = $request->validate([
            'company_id' => 'required|uuid|exists:companies,id',
            'code' => 'required|string|max:50',
            'name' => 'required|string|max:255',
        ]);

        $category = \App\Models\DocumentCategory::firstOrCreate(
            ['company_id' => $data['company_id'], 'code' => $data['code']],
            ['name' => $data['name'], 'status' => 'active']
        );

        return response()->json(['data' => $category], 201);
    }
}
