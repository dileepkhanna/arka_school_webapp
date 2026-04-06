<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminExamCyclesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $rows = DB::table('exam_cycles')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'exam_type' => $row->exam_type,
                'cycle_number' => (int) $row->cycle_number,
                'start_date' => $row->start_date,
                'end_date' => $row->end_date,
                'is_active' => (bool) $row->is_active,
                'created_at' => $row->created_at,
            ]);

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'exam_type' => ['required', 'string'],
            'cycle_number' => ['required', 'integer', 'min:1'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date'],
        ]);

        $id = DB::table('exam_cycles')->insertGetId([
            'exam_type' => $validated['exam_type'],
            'cycle_number' => $validated['cycle_number'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'is_active' => false,
            'created_by' => $request->user()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['id' => (string) $id], 201);
    }

    public function toggleActive(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $cycle = DB::table('exam_cycles')->where('id', $id)->first();
        if (! $cycle) {
            return response()->json(['message' => 'Cycle not found'], 404);
        }

        $nextState = ! (bool) $cycle->is_active;

        DB::transaction(function () use ($cycle, $id, $nextState): void {
            if ($nextState) {
                DB::table('exam_cycles')->where('exam_type', $cycle->exam_type)->update([
                    'is_active' => false,
                    'updated_at' => now(),
                ]);
            }

            DB::table('exam_cycles')->where('id', $id)->update([
                'is_active' => $nextState,
                'updated_at' => now(),
            ]);
        });

        return response()->json(['is_active' => $nextState]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        DB::table('exam_cycles')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    private function isAdmin(Request $request): bool
    {
        return DB::table('user_roles')->where('user_id', $request->user()->id)->value('role') === 'admin';
    }
}
