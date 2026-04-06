<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminSyllabusController extends Controller
{
    public function data(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $syllabus = Schema::hasTable('syllabus')
            ? DB::table('syllabus')
                ->leftJoin('classes', 'classes.id', '=', 'syllabus.class_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'syllabus.subject_id')
                ->select(
                    'syllabus.id',
                    'syllabus.class_id',
                    'syllabus.subject_id',
                    'syllabus.syllabus_type',
                    'syllabus.exam_type',
                    'syllabus.chapter_name',
                    'syllabus.topic_name',
                    'syllabus.week_number',
                    'syllabus.schedule_date',
                    'syllabus.schedule_time',
                    'syllabus.start_date',
                    'syllabus.end_date',
                    'syllabus.completed_at',
                    'syllabus.completed_by',
                    'classes.name as class_name',
                    'classes.section as class_section',
                    'subjects.name as subject_name'
                )
                ->orderBy('syllabus.chapter_name')
                ->orderBy('syllabus.topic_name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'class_id' => (string) $row->class_id,
                    'subject_id' => (string) $row->subject_id,
                    'syllabus_type' => $row->syllabus_type,
                    'exam_type' => $row->exam_type,
                    'chapter_name' => $row->chapter_name,
                    'topic_name' => $row->topic_name,
                    'week_number' => $row->week_number !== null ? (int) $row->week_number : null,
                    'schedule_date' => $row->schedule_date,
                    'schedule_time' => $row->schedule_time,
                    'start_date' => $row->start_date,
                    'end_date' => $row->end_date,
                    'completed_at' => $row->completed_at,
                    'completed_by' => $row->completed_by ? (string) $row->completed_by : null,
                    'classes' => $row->class_name ? [
                        'name' => $row->class_name,
                        'section' => $row->class_section,
                    ] : null,
                    'subjects' => $row->subject_name ? [
                        'name' => $row->subject_name,
                    ] : null,
                ])
            : collect();

        $classes = collect();
        if (Schema::hasTable('classes')) {
            $classSelect = ['id', 'name', 'section'];
            $hasAcademicType = Schema::hasColumn('classes', 'academic_type');
            if ($hasAcademicType) {
                $classSelect[] = 'academic_type';
            }

            $classes = DB::table('classes')
                ->select($classSelect)
                ->orderBy('name')
                ->orderBy('section')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'name' => $row->name,
                    'section' => $row->section,
                    'academic_type' => $hasAcademicType ? ($row->academic_type ?? null) : null,
                ]);
        }

        $subjects = collect();
        if (Schema::hasTable('subjects')) {
            $subjectSelect = ['id', 'name'];
            $hasCategory = Schema::hasColumn('subjects', 'category');
            $hasExamType = Schema::hasColumn('subjects', 'exam_type');
            if ($hasCategory) {
                $subjectSelect[] = 'category';
            }
            if ($hasExamType) {
                $subjectSelect[] = 'exam_type';
            }

            $subjects = DB::table('subjects')
                ->select($subjectSelect)
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'name' => $row->name,
                    'category' => $hasCategory ? ($row->category ?? null) : null,
                    'exam_type' => $hasExamType ? ($row->exam_type ?? null) : null,
                ]);
        }

        $teachers = Schema::hasTable('teachers')
            ? DB::table('teachers')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
            ->select('teachers.id', 'teachers.user_id', 'profiles.full_name')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'user_id' => (string) $row->user_id,
                'fullName' => $row->full_name ?: 'Unknown',
            ])
            : collect();

        $teacherMappings = Schema::hasTable('teacher_syllabus_map')
            ? DB::table('teacher_syllabus_map')
            ->leftJoin('teachers', 'teachers.id', '=', 'teacher_syllabus_map.teacher_id')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
            ->select(
                'teacher_syllabus_map.id',
                'teacher_syllabus_map.teacher_id',
                'teacher_syllabus_map.syllabus_id',
                'teacher_syllabus_map.role_type',
                'profiles.full_name as teacher_name'
            )
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'teacher_id' => (string) $row->teacher_id,
                'syllabus_id' => (string) $row->syllabus_id,
                'role_type' => $row->role_type,
                'teacherName' => $row->teacher_name ?: 'Unknown',
                'roleLabel' => match ($row->role_type) {
                    'lead' => 'Lead Faculty',
                    'practice' => 'Practice Faculty',
                    'doubt' => 'Doubt Faculty',
                    default => $row->role_type,
                },
            ])
            : collect();

        $completedByNames = Schema::hasTable('profiles')
            ? DB::table('profiles')
            ->select('user_id', 'full_name')
            ->get()
            ->reduce(function (array $carry, $row) {
                $carry[(string) $row->user_id] = $row->full_name;
                return $carry;
            }, [])
            : [];

        return response()->json([
            'syllabus' => $syllabus,
            'classes' => $classes,
            'subjects' => $subjects,
            'teachers' => $teachers,
            'teacherMappings' => $teacherMappings,
            'completedByNames' => $completedByNames,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('syllabus')) {
            return response()->json(['message' => 'syllabus table not found'], 422);
        }

        $validated = $request->validate([
            'class_id' => ['required', 'integer'],
            'subject_id' => ['required', 'integer'],
            'syllabus_type' => ['required', 'string'],
            'exam_type' => ['nullable', 'string'],
            'chapter_name' => ['nullable', 'string'],
            'topic_name' => ['required', 'string'],
            'week_number' => ['nullable', 'integer'],
            'schedule_date' => ['nullable', 'date'],
            'schedule_time' => ['nullable', 'date_format:H:i'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'pending_teachers' => ['nullable', 'array'],
            'pending_teachers.*.teacher_id' => ['required_with:pending_teachers', 'integer'],
            'pending_teachers.*.role_type' => ['required_with:pending_teachers', 'string'],
        ]);

        $id = DB::table('syllabus')->insertGetId([
            'class_id' => $validated['class_id'],
            'subject_id' => $validated['subject_id'],
            'syllabus_type' => $validated['syllabus_type'],
            'exam_type' => $validated['exam_type'] ?? null,
            'chapter_name' => $validated['chapter_name'] ?? '',
            'topic_name' => $validated['topic_name'],
            'week_number' => $validated['week_number'] ?? null,
            'schedule_date' => $validated['schedule_date'] ?? null,
            'schedule_time' => $validated['schedule_time'] ?? null,
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'created_by' => $request->user()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $pendingTeachers = $validated['pending_teachers'] ?? [];
        if (! empty($pendingTeachers) && Schema::hasTable('teacher_syllabus_map')) {
            $rows = collect($pendingTeachers)->map(fn ($teacher) => [
                'teacher_id' => $teacher['teacher_id'],
                'syllabus_id' => $id,
                'role_type' => $teacher['role_type'],
                'created_at' => now(),
                'updated_at' => now(),
            ])->all();
            DB::table('teacher_syllabus_map')->insert($rows);
        }

        return response()->json(['id' => (string) $id], 201);
    }

    public function bulkStore(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.class_id' => ['required', 'integer'],
            'rows.*.subject_id' => ['required', 'integer'],
            'rows.*.syllabus_type' => ['required', 'string'],
            'rows.*.exam_type' => ['nullable', 'string'],
            'rows.*.chapter_name' => ['nullable', 'string'],
            'rows.*.topic_name' => ['required', 'string'],
            'rows.*.week_number' => ['nullable', 'integer'],
            'rows.*.schedule_date' => ['nullable', 'date'],
            'rows.*.schedule_time' => ['nullable', 'date_format:H:i'],
            'rows.*.start_date' => ['nullable', 'date'],
            'rows.*.end_date' => ['nullable', 'date'],
            'pending_teachers' => ['nullable', 'array'],
            'pending_teachers.*.teacher_id' => ['required_with:pending_teachers', 'integer'],
            'pending_teachers.*.role_type' => ['required_with:pending_teachers', 'string'],
        ]);

        $insertedIds = [];

        DB::transaction(function () use ($validated, $request, &$insertedIds): void {
            foreach ($validated['rows'] as $row) {
                $insertedIds[] = DB::table('syllabus')->insertGetId([
                    'class_id' => $row['class_id'],
                    'subject_id' => $row['subject_id'],
                    'syllabus_type' => $row['syllabus_type'],
                    'exam_type' => $row['exam_type'] ?? null,
                    'chapter_name' => $row['chapter_name'] ?? '',
                    'topic_name' => $row['topic_name'],
                    'week_number' => $row['week_number'] ?? null,
                    'schedule_date' => $row['schedule_date'] ?? null,
                    'schedule_time' => $row['schedule_time'] ?? null,
                    'start_date' => $row['start_date'] ?? null,
                    'end_date' => $row['end_date'] ?? null,
                    'created_by' => $request->user()->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $pendingTeachers = $validated['pending_teachers'] ?? [];
            if (! empty($pendingTeachers) && ! empty($insertedIds) && Schema::hasTable('teacher_syllabus_map')) {
                $mapRows = [];
                foreach ($insertedIds as $syllabusId) {
                    foreach ($pendingTeachers as $teacher) {
                        $mapRows[] = [
                            'teacher_id' => $teacher['teacher_id'],
                            'syllabus_id' => $syllabusId,
                            'role_type' => $teacher['role_type'],
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                }
                DB::table('teacher_syllabus_map')->insert($mapRows);
            }
        });

        return response()->json([
            'count' => count($insertedIds),
            'ids' => array_map(fn ($id) => (string) $id, $insertedIds),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'class_id' => ['required', 'integer'],
            'subject_id' => ['required', 'integer'],
            'syllabus_type' => ['required', 'string'],
            'exam_type' => ['nullable', 'string'],
            'chapter_name' => ['nullable', 'string'],
            'topic_name' => ['required', 'string'],
            'week_number' => ['nullable', 'integer'],
            'schedule_date' => ['nullable', 'date'],
            'schedule_time' => ['nullable', 'date_format:H:i'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        DB::table('syllabus')->where('id', $id)->update([
            'class_id' => $validated['class_id'],
            'subject_id' => $validated['subject_id'],
            'syllabus_type' => $validated['syllabus_type'],
            'exam_type' => $validated['exam_type'] ?? null,
            'chapter_name' => $validated['chapter_name'] ?? '',
            'topic_name' => $validated['topic_name'],
            'week_number' => $validated['week_number'] ?? null,
            'schedule_date' => $validated['schedule_date'] ?? null,
            'schedule_time' => $validated['schedule_time'] ?? null,
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Updated']);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (Schema::hasTable('teacher_syllabus_map')) {
            DB::table('teacher_syllabus_map')->where('syllabus_id', $id)->delete();
        }
        if (Schema::hasTable('syllabus')) {
            DB::table('syllabus')->where('id', $id)->delete();
        }

        return response()->json(['message' => 'Deleted']);
    }

    public function assignTeacher(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'teacher_id' => ['required', 'integer'],
            'role_type' => ['required', 'string'],
        ]);

        $mappingId = DB::table('teacher_syllabus_map')->insertGetId([
            'teacher_id' => $validated['teacher_id'],
            'syllabus_id' => $id,
            'role_type' => $validated['role_type'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['id' => (string) $mappingId], 201);
    }

    public function removeTeacherMapping(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('teacher_syllabus_map')) {
            return response()->json(['message' => 'teacher_syllabus_map table not found'], 422);
        }

        DB::table('teacher_syllabus_map')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    private function isAdmin(Request $request): bool
    {
        return DB::table('user_roles')->where('user_id', $request->user()->id)->value('role') === 'admin';
    }
}
        if (! Schema::hasTable('syllabus')) {
            return response()->json(['message' => 'syllabus table not found'], 422);
        }

        if (! Schema::hasTable('syllabus')) {
            return response()->json(['message' => 'syllabus table not found'], 422);
        }

        if (! Schema::hasTable('teacher_syllabus_map')) {
            return response()->json(['message' => 'teacher_syllabus_map table not found'], 422);
        }
