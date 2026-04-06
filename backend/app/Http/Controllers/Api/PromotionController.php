<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PromotionHistory;
use App\Models\SchoolClass;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PromotionController extends Controller
{
    public function execute(Request $request): JsonResponse
    {
        $data = $request->validate([
            'source_class_id' => 'required|integer|exists:classes,id',
            'target_class_id' => 'required|integer|exists:classes,id|different:source_class_id',
            'academic_year' => 'required|string|max:20',
        ]);

        $user = $request->user();
        if ($user->role?->role !== 'admin') {
            return response()->json(['message' => 'Insufficient privileges.'], 403);
        }

        $targetClass = SchoolClass::find($data['target_class_id']);
        if (! $targetClass) {
            return response()->json(['message' => 'Target class not found.'], 404);
        }

        $students = Student::where('class_id', $data['source_class_id'])
            ->where('status', 'active')
            ->get();

        if ($students->isEmpty()) {
            return response()->json([
                'message' => 'No active students found in the selected source class.',
            ], 422);
        }

        DB::transaction(function () use ($students, $data, $user, $targetClass): void {
            foreach ($students as $student) {
                $identifiers = $this->buildIdentifiersForClass($student, $targetClass);

                PromotionHistory::create([
                    'student_id' => $student->id,
                    'from_class_id' => $student->class_id,
                    'to_class_id' => $targetClass->id,
                    'from_admission_number' => $student->admission_number,
                    'to_admission_number' => $identifiers['admission_number'],
                    'from_login_id' => $student->login_id,
                    'to_login_id' => $identifiers['login_id'],
                    'academic_year' => $data['academic_year'],
                    'promoted_by' => $user->id,
                ]);

                $student->update([
                    'class_id' => $targetClass->id,
                    'admission_number' => $identifiers['admission_number'],
                    'login_id' => $identifiers['login_id'],
                ]);
            }
        });

        return response()->json([
            'message' => 'Promotion completed successfully. Student admission and login IDs were updated to the promoted class, and the target class teacher now automatically owns those students through class assignment.',
            'promoted_count' => $students->count(),
            'target_class' => $this->formatClassName($targetClass),
        ]);
    }

    public function executeSingle(Request $request): JsonResponse
    {
        $data = $request->validate([
            'student_id' => 'required|integer|exists:students,id',
            'target_class_id' => 'required|integer|exists:classes,id',
            'academic_year' => 'required|string|max:20',
        ]);

        $user = $request->user();
        if ($user->role?->role !== 'admin') {
            return response()->json(['message' => 'Insufficient privileges.'], 403);
        }

        $student = Student::find($data['student_id']);
        $targetClass = SchoolClass::find($data['target_class_id']);

        if (! $student || $student->status !== 'active') {
            return response()->json(['message' => 'Selected student is not active.'], 422);
        }

        if (! $targetClass) {
            return response()->json(['message' => 'Target class not found.'], 404);
        }

        if ((int) $student->class_id === (int) $targetClass->id) {
            return response()->json(['message' => 'Student is already assigned to the selected class.'], 422);
        }

        $identifiers = $this->buildIdentifiersForClass($student, $targetClass);

        DB::transaction(function () use ($student, $targetClass, $data, $user, $identifiers): void {
            PromotionHistory::create([
                'student_id' => $student->id,
                'from_class_id' => $student->class_id,
                'to_class_id' => $targetClass->id,
                'from_admission_number' => $student->admission_number,
                'to_admission_number' => $identifiers['admission_number'],
                'from_login_id' => $student->login_id,
                'to_login_id' => $identifiers['login_id'],
                'academic_year' => $data['academic_year'],
                'promoted_by' => $user->id,
            ]);

            $student->update([
                'class_id' => $targetClass->id,
                'admission_number' => $identifiers['admission_number'],
                'login_id' => $identifiers['login_id'],
            ]);
        });

        return response()->json([
            'message' => 'Student promoted successfully. Admission/login IDs now reflect the new class, and the class teacher access follows the new class automatically.',
            'student_id' => $student->id,
            'student_name' => $student->full_name,
            'admission_number' => $identifiers['admission_number'],
            'login_id' => $identifiers['login_id'],
            'target_class' => $this->formatClassName($targetClass),
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role?->role !== 'admin') {
            return response()->json(['message' => 'Insufficient privileges.'], 403);
        }

        $query = PromotionHistory::with([
            'student:id,full_name,admission_number,login_id',
            'fromClass:id,name,section',
            'toClass:id,name,section',
        ])->orderByDesc('created_at');

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->integer('student_id'));
        }

        if ($request->filled('academic_year')) {
            $query->where('academic_year', (string) $request->string('academic_year'));
        }

        $paginator = $query->paginate(50);
        $paginator->setCollection(
            $paginator->getCollection()->map(fn (PromotionHistory $history) => $this->mapHistoryRecord($history))
        );

        return response()->json($paginator);
    }

    public function rollback(Request $request): JsonResponse
    {
        $data = $request->validate([
            'batch_academic_year' => 'required|string|max:20',
            'source_class_id' => 'required|integer|exists:classes,id',
            'target_class_id' => 'required|integer|exists:classes,id',
        ]);

        $user = $request->user();
        if ($user->role?->role !== 'admin') {
            return response()->json(['message' => 'Insufficient privileges.'], 403);
        }

        $batch = PromotionHistory::where('academic_year', $data['batch_academic_year'])
            ->where('from_class_id', $data['source_class_id'])
            ->where('to_class_id', $data['target_class_id'])
            ->get();

        if ($batch->isEmpty()) {
            return response()->json(['message' => 'No matching promotion batch found.'], 404);
        }

        $result = DB::transaction(function () use ($batch): array {
            $restoredCount = 0;
            $skippedStudentIds = [];

            foreach ($batch as $history) {
                $updated = Student::where('id', $history->student_id)
                    ->where('class_id', $history->to_class_id)
                    ->update([
                        'class_id' => $history->from_class_id,
                        'admission_number' => $history->from_admission_number,
                        'login_id' => $history->from_login_id,
                    ]);

                if ($updated > 0) {
                    $restoredCount += $updated;
                } else {
                    $skippedStudentIds[] = (int) $history->student_id;
                }
            }

            PromotionHistory::whereIn('id', $batch->pluck('id'))->delete();

            return [
                'restored_count' => $restoredCount,
                'skipped_student_ids' => $skippedStudentIds,
            ];
        });

        if ($result['restored_count'] === 0) {
            return response()->json([
                'message' => 'Rollback could not be applied because the students are no longer in the promoted class.',
                'restored_count' => 0,
                'skipped_student_ids' => $result['skipped_student_ids'],
            ], 409);
        }

        return response()->json([
            'message' => empty($result['skipped_student_ids'])
                ? 'Rollback completed successfully. Original class and student identifiers were restored.'
                : 'Rollback completed with partial restores. Some students were skipped because their active class had already changed.',
            'restored_count' => $result['restored_count'],
            'skipped_count' => count($result['skipped_student_ids']),
            'skipped_student_ids' => $result['skipped_student_ids'],
        ]);
    }

    public function rollbackSingle(Request $request): JsonResponse
    {
        $data = $request->validate([
            'promotion_history_id' => 'required|integer|exists:promotion_history,id',
        ]);

        $user = $request->user();
        if ($user->role?->role !== 'admin') {
            return response()->json(['message' => 'Insufficient privileges.'], 403);
        }

        $history = PromotionHistory::find($data['promotion_history_id']);
        if (! $history) {
            return response()->json(['message' => 'Promotion record not found.'], 404);
        }

        $restored = DB::transaction(function () use ($history): int {
            $updated = Student::where('id', $history->student_id)
                ->where('class_id', $history->to_class_id)
                ->update([
                    'class_id' => $history->from_class_id,
                        'admission_number' => $history->from_admission_number,
                        'login_id' => $history->from_login_id,
                ]);

            if ($updated > 0) {
                $history->delete();
            }

            return $updated;
        });

        if ($restored === 0) {
            return response()->json([
                'message' => 'Student promotion could not be reverted because the student is no longer in the promoted class.',
                'restored_student_id' => $history->student_id,
            ], 409);
        }

        return response()->json([
            'message' => 'Student promotion reverted successfully.',
            'restored_student_id' => $history->student_id,
        ]);
    }

    private function mapHistoryRecord(PromotionHistory $history): array
    {
        return [
            'id' => $history->id,
            'student' => $history->student ? [
                'id' => $history->student->id,
                'full_name' => $history->student->full_name,
                'admission_number' => $history->student->admission_number,
                'login_id' => $history->student->login_id,
            ] : null,
            'from_class' => $history->fromClass ? [
                'id' => $history->fromClass->id,
                'name' => $history->fromClass->name,
                'section' => $history->fromClass->section,
            ] : null,
            'to_class' => $history->toClass ? [
                'id' => $history->toClass->id,
                'name' => $history->toClass->name,
                'section' => $history->toClass->section,
            ] : null,
            'from_admission_number' => $history->from_admission_number,
            'to_admission_number' => $history->to_admission_number,
            'from_login_id' => $history->from_login_id,
            'to_login_id' => $history->to_login_id,
            'academic_year' => $history->academic_year,
            'batch_key' => $this->batchKey($history),
            'created_at' => $history->created_at,
        ];
    }

    private function batchKey(PromotionHistory $history): string
    {
        return implode(':', [
            (string) $history->academic_year,
            (string) ($history->from_class_id ?? 'none'),
            (string) ($history->to_class_id ?? 'none'),
        ]);
    }

    private function buildIdentifiersForClass(Student $student, SchoolClass $targetClass): array
    {
        $baseIdentifier = $this->buildBaseStudentIdentifier($student->full_name, $targetClass->name, (string) $targetClass->section);
        $candidate = $baseIdentifier;
        $counter = 1;

        while ($this->studentIdentifierExists($candidate, $student->id)) {
            $counter++;
            $candidate = $baseIdentifier.$counter;
        }

        return [
            'admission_number' => $candidate,
            'login_id' => $candidate,
        ];
    }

    private function buildBaseStudentIdentifier(string $fullName, string $className, string $section): string
    {
        $namePart = strtoupper(preg_replace('/[^A-Z]/', '', explode(' ', strtoupper($fullName))[0] ?? 'NAME'));
        $classPart = strtoupper(preg_replace('/[^A-Z0-9]/', '', strtoupper($className)));
        $sectionPart = strtoupper(preg_replace('/[^A-Z0-9]/', '', strtoupper($section)));

        $base = ($namePart ?: 'NAME').'-'.($classPart ?: 'CLASS');
        if ($sectionPart !== '') {
            $base .= '-'.$sectionPart;
        }

        return $base;
    }

    private function studentIdentifierExists(string $candidate, int $ignoreStudentId): bool
    {
        return Student::query()
            ->where('id', '!=', $ignoreStudentId)
            ->where(function ($query) use ($candidate) {
                $query->where('admission_number', $candidate)
                    ->orWhere('login_id', $candidate);
            })
            ->exists();
    }

    private function formatClassName(?SchoolClass $class): string
    {
        if (! $class) {
            return 'Unknown class';
        }

        return $class->section ? $class->name.' - '.$class->section : $class->name;
    }
}
