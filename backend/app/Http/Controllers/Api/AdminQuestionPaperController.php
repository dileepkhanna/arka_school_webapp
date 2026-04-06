<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminQuestionPaperController extends Controller
{
    public function data(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $exams = DB::table('weekly_exams')
            ->leftJoin('classes', 'classes.id', '=', 'weekly_exams.class_id')
            ->select(
                'weekly_exams.id',
                'weekly_exams.exam_title',
                'weekly_exams.class_id',
                'weekly_exams.total_marks',
                'weekly_exams.status',
                'classes.name as class_name',
                'classes.section as class_section'
            )
            ->orderByDesc('weekly_exams.exam_date')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'exam_title' => $row->exam_title,
                'class_id' => $row->class_id ? (string) $row->class_id : null,
                'total_marks' => (int) ($row->total_marks ?? 0),
                'status' => $row->status,
                'classes' => $row->class_name ? [
                    'name' => $row->class_name,
                    'section' => $row->class_section,
                ] : null,
            ]);

        $classes = DB::table('classes')
            ->select('id', 'name', 'section')
            ->orderBy('name')
            ->orderBy('section')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'name' => $row->name,
                'section' => $row->section,
            ]);

        $papers = Schema::hasTable('question_papers')
            ? DB::table('question_papers')
                ->orderByDesc('created_at')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'exam_id' => (string) $row->exam_id,
                    'class_id' => (string) $row->class_id,
                    'total_questions' => (int) ($row->total_questions ?? 0),
                    'total_marks' => (int) ($row->total_marks ?? 0),
                    'uploaded_by' => $row->uploaded_by ? (string) $row->uploaded_by : null,
                    'created_at' => $row->created_at,
                ])
            : collect();

        $questions = Schema::hasTable('questions')
            ? DB::table('questions')
                ->orderBy('question_number')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'question_paper_id' => (string) $row->question_paper_id,
                    'question_number' => (int) $row->question_number,
                    'question_text' => $row->question_text,
                    'question_type' => $row->question_type,
                    'option_a' => $row->option_a,
                    'option_b' => $row->option_b,
                    'option_c' => $row->option_c,
                    'option_d' => $row->option_d,
                    'correct_answer' => $row->correct_answer,
                    'explanation' => $row->explanation,
                    'marks' => (int) ($row->marks ?? 0),
                ])
            : collect();

        return response()->json([
            'exams' => $exams,
            'classes' => $classes,
            'papers' => $papers,
            'questions' => $questions,
        ]);
    }

    public function questions(Request $request, int $paperId): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('questions')) {
            return response()->json([]);
        }

        $questions = DB::table('questions')
            ->where('question_paper_id', $paperId)
            ->orderBy('question_number')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'question_paper_id' => (string) $row->question_paper_id,
                'question_number' => (int) $row->question_number,
                'question_text' => $row->question_text,
                'question_type' => $row->question_type,
                'option_a' => $row->option_a,
                'option_b' => $row->option_b,
                'option_c' => $row->option_c,
                'option_d' => $row->option_d,
                'correct_answer' => $row->correct_answer,
                'explanation' => $row->explanation,
                'marks' => (int) ($row->marks ?? 0),
            ]);

        return response()->json($questions);
    }

    public function storePaper(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('question_papers')) {
            return response()->json(['message' => 'question_papers table not found'], 422);
        }

        $validated = $request->validate([
            'exam_id' => ['required', 'integer'],
            'class_id' => ['required', 'integer'],
        ]);

        $id = DB::table('question_papers')->insertGetId([
            'exam_id' => $validated['exam_id'],
            'class_id' => $validated['class_id'],
            'total_questions' => 0,
            'total_marks' => 0,
            'uploaded_by' => $request->user()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['id' => (string) $id], 201);
    }

    public function deletePaper(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('question_papers')) {
            return response()->json(['message' => 'question_papers table not found'], 422);
        }

        DB::transaction(function () use ($id): void {
            if (Schema::hasTable('questions')) {
                DB::table('questions')->where('question_paper_id', $id)->delete();
            }
            DB::table('question_papers')->where('id', $id)->delete();
        });

        return response()->json(['message' => 'Deleted']);
    }

    public function storeQuestion(Request $request, int $paperId): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('questions')) {
            return response()->json(['message' => 'questions table not found'], 422);
        }

        $validated = $request->validate([
            'question_number' => ['required', 'integer', 'min:1'],
            'question_text' => ['required', 'string'],
            'question_type' => ['required', 'string'],
            'option_a' => ['nullable', 'string'],
            'option_b' => ['nullable', 'string'],
            'option_c' => ['nullable', 'string'],
            'option_d' => ['nullable', 'string'],
            'correct_answer' => ['nullable', 'string'],
            'explanation' => ['nullable', 'string'],
            'marks' => ['required', 'integer', 'min:1'],
        ]);

        $id = DB::table('questions')->insertGetId([
            'question_paper_id' => $paperId,
            'question_number' => $validated['question_number'],
            'question_text' => $validated['question_text'],
            'question_type' => $validated['question_type'],
            'option_a' => $validated['option_a'] ?? null,
            'option_b' => $validated['option_b'] ?? null,
            'option_c' => $validated['option_c'] ?? null,
            'option_d' => $validated['option_d'] ?? null,
            'correct_answer' => $validated['correct_answer'] ?? null,
            'explanation' => $validated['explanation'] ?? null,
            'marks' => $validated['marks'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->recalculatePaperTotals($paperId);

        return response()->json(['id' => (string) $id], 201);
    }

    public function updateQuestion(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('questions')) {
            return response()->json(['message' => 'questions table not found'], 422);
        }

        $validated = $request->validate([
            'question_text' => ['required', 'string'],
            'question_type' => ['required', 'string'],
            'option_a' => ['nullable', 'string'],
            'option_b' => ['nullable', 'string'],
            'option_c' => ['nullable', 'string'],
            'option_d' => ['nullable', 'string'],
            'correct_answer' => ['nullable', 'string'],
            'explanation' => ['nullable', 'string'],
            'marks' => ['required', 'integer', 'min:1'],
        ]);

        $paperId = DB::table('questions')->where('id', $id)->value('question_paper_id');
        if (! $paperId) {
            return response()->json(['message' => 'Question not found'], 404);
        }

        DB::table('questions')->where('id', $id)->update([
            'question_text' => $validated['question_text'],
            'question_type' => $validated['question_type'],
            'option_a' => $validated['option_a'] ?? null,
            'option_b' => $validated['option_b'] ?? null,
            'option_c' => $validated['option_c'] ?? null,
            'option_d' => $validated['option_d'] ?? null,
            'correct_answer' => $validated['correct_answer'] ?? null,
            'explanation' => $validated['explanation'] ?? null,
            'marks' => $validated['marks'],
            'updated_at' => now(),
        ]);

        $this->recalculatePaperTotals((int) $paperId);

        return response()->json(['message' => 'Updated']);
    }

    public function deleteQuestion(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('questions')) {
            return response()->json(['message' => 'questions table not found'], 422);
        }

        $question = DB::table('questions')->where('id', $id)->first();
        if (! $question) {
            return response()->json(['message' => 'Question not found'], 404);
        }

        $paperId = (int) $question->question_paper_id;

        DB::transaction(function () use ($id, $paperId): void {
            DB::table('questions')->where('id', $id)->delete();

            $remaining = DB::table('questions')
                ->where('question_paper_id', $paperId)
                ->orderBy('question_number')
                ->select('id')
                ->get();

            foreach ($remaining as $index => $row) {
                DB::table('questions')->where('id', $row->id)->update([
                    'question_number' => $index + 1,
                    'updated_at' => now(),
                ]);
            }
        });

        $this->recalculatePaperTotals($paperId);

        return response()->json(['message' => 'Deleted']);
    }

    private function recalculatePaperTotals(int $paperId): void
    {
        if (! Schema::hasTable('questions') || ! Schema::hasTable('question_papers')) {
            return;
        }

        $rows = DB::table('questions')->where('question_paper_id', $paperId)->select('marks')->get();
        $totalQuestions = $rows->count();
        $totalMarks = (int) $rows->sum(fn ($row) => (int) ($row->marks ?? 0));

        DB::table('question_papers')->where('id', $paperId)->update([
            'total_questions' => $totalQuestions,
            'total_marks' => $totalMarks,
            'updated_at' => now(),
        ]);
    }

    private function isAdmin(Request $request): bool
    {
        return DB::table('user_roles')->where('user_id', $request->user()->id)->value('role') === 'admin';
    }
}
