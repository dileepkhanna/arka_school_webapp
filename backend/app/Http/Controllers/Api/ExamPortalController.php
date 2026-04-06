<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ExamPortalController extends Controller
{
    public function examsData(): JsonResponse
    {
        $classes = Schema::hasTable('classes')
            ? DB::table('classes')->select('id', 'name', 'section')->orderBy('name')->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'section' => $r->section,
            ])
            : collect();

        $subjects = Schema::hasTable('subjects')
            ? DB::table('subjects')->select('id', 'name', 'category')->orderBy('name')->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'category' => $r->category,
            ])
            : collect();

        $exams = collect();
        if (Schema::hasTable('exams')) {
            $exams = DB::table('exams')
                ->leftJoin('classes', 'classes.id', '=', 'exams.class_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'exams.subject_id')
                ->select(
                    'exams.id',
                    'exams.name',
                    'exams.exam_date',
                    'exams.exam_time',
                    'exams.max_marks',
                    'exams.class_id',
                    'exams.subject_id',
                    'classes.name as class_name',
                    'classes.section as class_section',
                    'subjects.name as subject_name'
                )
                ->orderByDesc('exams.exam_date')
                ->get()
                ->map(fn ($r) => [
                    'id' => (string) $r->id,
                    'name' => $r->name,
                    'exam_date' => $r->exam_date,
                    'exam_time' => $r->exam_time,
                    'max_marks' => $r->max_marks,
                    'class_id' => $r->class_id ? (string) $r->class_id : null,
                    'subject_id' => $r->subject_id ? (string) $r->subject_id : null,
                    'classes' => $r->class_name ? ['name' => $r->class_name, 'section' => $r->class_section] : null,
                    'subjects' => $r->subject_name ? ['name' => $r->subject_name] : null,
                ]);
        }

        return response()->json([
            'exams' => $exams,
            'classes' => $classes,
            'subjects' => $subjects,
        ]);
    }

    public function deleteExam(int $id): JsonResponse
    {
        if (Schema::hasTable('exams')) {
            DB::table('exams')->where('id', $id)->delete();
        }

        return response()->json(['message' => 'Deleted']);
    }

    public function createExamsBulk(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'records' => ['required', 'array', 'min:1'],
            'records.*.name' => ['required', 'string'],
            'records.*.exam_date' => ['nullable', 'date'],
            'records.*.exam_time' => ['nullable', 'string'],
            'records.*.max_marks' => ['nullable', 'numeric'],
            'records.*.class_id' => ['nullable'],
            'records.*.subject_id' => ['nullable'],
        ]);

        if (! Schema::hasTable('exams')) {
            return response()->json(['message' => 'exams table not found'], 422);
        }

        $rows = collect($validated['records'])->map(function ($r) {
            return [
                'name' => $r['name'],
                'exam_date' => $r['exam_date'] ?? null,
                'exam_time' => $this->normalizeExamTime($r['exam_time'] ?? null),
                'max_marks' => $r['max_marks'] ?? 100,
                'class_id' => $r['class_id'] ?? null,
                'subject_id' => $r['subject_id'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        })->all();

        try {
            DB::table('exams')->insert($rows);
        } catch (QueryException $e) {
            return response()->json(['message' => 'Invalid exam payload. Please check date/time values.'], 422);
        }

        $classIds = collect($rows)
            ->pluck('class_id')
            ->filter()
            ->map(fn ($v) => (int) $v)
            ->unique()
            ->values()
            ->all();

        $recipientIds = $this->classRecipientUserIds($classIds);
        app(NotificationService::class)->notifyUsers(
            $recipientIds,
            'New exam scheduled',
            count($rows).' exam(s) have been scheduled. Check exam calendar.',
            [
                'type' => 'exam_schedule',
                'link' => '/parent/exams',
                'entity_type' => 'exam',
                'priority' => 'normal',
                'channel' => 'both',
            ]
        );

        return response()->json(['message' => 'Created', 'count' => count($rows)], 201);
    }

    public function weeklyData(): JsonResponse
    {
        $exams = collect();
        if (Schema::hasTable('weekly_exams')) {
            $hasSubjectId = Schema::hasColumn('weekly_exams', 'subject_id');
            $query = DB::table('weekly_exams')
                ->leftJoin('classes', 'classes.id', '=', 'weekly_exams.class_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'weekly_exams.subject_id')
                ->select(
                    'weekly_exams.*',
                    'classes.name as class_name',
                    'classes.section as class_section',
                    'subjects.name as subject_name'
                )
                ->orderByDesc('weekly_exams.exam_date');

            if (! $hasSubjectId) {
                $query = DB::table('weekly_exams')
                    ->leftJoin('classes', 'classes.id', '=', 'weekly_exams.class_id')
                    ->select('weekly_exams.*', 'classes.name as class_name', 'classes.section as class_section')
                    ->orderByDesc('weekly_exams.exam_date');
            }

            $exams = $query->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'class_id' => (string) $r->class_id,
                'subject_id' => property_exists($r, 'subject_id') && $r->subject_id ? (string) $r->subject_id : null,
                'syllabus_type' => $r->syllabus_type,
                'cycle_id' => $r->cycle_id ? (string) $r->cycle_id : null,
                'week_number' => $r->week_number,
                'exam_title' => $r->exam_title,
                'exam_date' => $r->exam_date,
                'exam_time' => $r->exam_time,
                'duration_minutes' => (int) $r->duration_minutes,
                'total_marks' => (int) $r->total_marks,
                'negative_marking' => (bool) $r->negative_marking,
                'negative_marks_value' => (float) ($r->negative_marks_value ?? 0),
                'reminder_enabled' => (bool) ($r->reminder_enabled ?? false),
                'status' => $r->status,
                'description' => $r->description ?? null,
                'exam_type_label' => $r->exam_type_label ?? null,
                'created_at' => $r->created_at,
                'classes' => $r->class_name ? ['name' => $r->class_name, 'section' => $r->class_section] : null,
                'subjects' => (property_exists($r, 'subject_name') && $r->subject_name) ? ['name' => $r->subject_name] : null,
            ]);
        }

        $syllabus = Schema::hasTable('syllabus')
            ? DB::table('syllabus')
                ->leftJoin('subjects', 'subjects.id', '=', 'syllabus.subject_id')
                ->select(
                    'syllabus.id', 'syllabus.chapter_name', 'syllabus.topic_name', 'syllabus.class_id',
                    'syllabus.syllabus_type', 'syllabus.exam_type', 'subjects.name as subject_name'
                )
                ->get()
                ->map(fn ($r) => [
                    'id' => (string) $r->id,
                    'chapter_name' => $r->chapter_name,
                    'topic_name' => $r->topic_name,
                    'class_id' => (string) $r->class_id,
                    'syllabus_type' => $r->syllabus_type,
                    'exam_type' => $r->exam_type,
                    'subjects' => $r->subject_name ? ['name' => $r->subject_name] : null,
                ])
            : collect();

        $links = Schema::hasTable('weekly_exam_syllabus')
            ? DB::table('weekly_exam_syllabus')->select('id', 'exam_id', 'syllabus_id')->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'exam_id' => (string) $r->exam_id,
                'syllabus_id' => (string) $r->syllabus_id,
            ])
            : collect();

        $classes = Schema::hasTable('classes')
            ? DB::table('classes')->select('id', 'name', 'section')->orderBy('name')->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'section' => $r->section,
            ])
            : collect();

        $subjects = Schema::hasTable('subjects')
            ? DB::table('subjects')->select('id', 'name', 'category')->orderBy('name')->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'category' => $r->category,
            ])
            : collect();

        $cycles = Schema::hasTable('exam_cycles')
            ? DB::table('exam_cycles')->select('id', 'exam_type', 'cycle_number', 'is_active')->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'exam_type' => $r->exam_type,
                'cycle_number' => $r->cycle_number,
                'is_active' => (bool) $r->is_active,
            ])
            : collect();

        return response()->json([
            'exams' => $exams,
            'syllabus' => $syllabus,
            'links' => $links,
            'classes' => $classes,
            'subjects' => $subjects,
            'cycles' => $cycles,
        ]);
    }

    public function createWeekly(Request $request): JsonResponse
    {
        if (! Schema::hasTable('weekly_exams')) {
            return response()->json(['message' => 'weekly_exams table not found'], 422);
        }

        $validated = $request->validate([
            'class_id' => ['required'],
            'subject_id' => ['nullable'],
            'syllabus_type' => ['required', 'string'],
            'cycle_id' => ['nullable'],
            'week_number' => ['nullable', 'integer'],
            'exam_title' => ['required', 'string'],
            'exam_date' => ['required', 'date'],
            'exam_time' => ['required', 'string'],
            'duration_minutes' => ['required', 'integer'],
            'total_marks' => ['required', 'integer'],
            'negative_marking' => ['boolean'],
            'negative_marks_value' => ['nullable', 'numeric'],
            'reminder_enabled' => ['boolean'],
            'status' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'exam_type_label' => ['nullable', 'string'],
            'created_by' => ['nullable'],
        ]);

        $hasSubjectId = Schema::hasColumn('weekly_exams', 'subject_id');
        $insert = [
            'class_id' => $validated['class_id'],
            'syllabus_type' => $validated['syllabus_type'],
            'cycle_id' => $validated['cycle_id'] ?? null,
            'week_number' => $validated['week_number'] ?? null,
            'exam_title' => $validated['exam_title'],
            'exam_date' => $validated['exam_date'],
            'exam_time' => $validated['exam_time'],
            'duration_minutes' => $validated['duration_minutes'],
            'total_marks' => $validated['total_marks'],
            'negative_marking' => $validated['negative_marking'] ?? false,
            'negative_marks_value' => $validated['negative_marks_value'] ?? 0,
            'reminder_enabled' => $validated['reminder_enabled'] ?? false,
            'status' => $validated['status'] ?? 'scheduled',
            'created_at' => now(),
            'updated_at' => now(),
        ];
        if ($hasSubjectId) {
            $insert['subject_id'] = $validated['subject_id'] ?? null;
        }
        if (Schema::hasColumn('weekly_exams', 'description')) {
            $insert['description'] = $validated['description'] ?? null;
        }
        if (Schema::hasColumn('weekly_exams', 'exam_type_label')) {
            $insert['exam_type_label'] = $validated['exam_type_label'] ?? null;
        }
        if (Schema::hasColumn('weekly_exams', 'created_by')) {
            $insert['created_by'] = $validated['created_by'] ?? null;
        }

        $id = DB::table('weekly_exams')->insertGetId($insert);

        $recipientIds = $this->classRecipientUserIds([(int) $validated['class_id']]);
        app(NotificationService::class)->notifyUsers(
            $recipientIds,
            'Weekly exam scheduled',
            $validated['exam_title'].' has been scheduled on '.$validated['exam_date'],
            [
                'type' => 'competitive_exam',
                'link' => '/parent/exams',
                'entity_type' => 'weekly_exam',
                'entity_id' => $id,
                'priority' => 'normal',
                'channel' => 'both',
            ]
        );

        return response()->json(['id' => (string) $id], 201);
    }

    public function updateWeekly(Request $request, int $id): JsonResponse
    {
        if (! Schema::hasTable('weekly_exams')) {
            return response()->json(['message' => 'weekly_exams table not found'], 422);
        }

        $validated = $request->validate([
            'class_id' => ['required'],
            'subject_id' => ['nullable'],
            'syllabus_type' => ['required', 'string'],
            'cycle_id' => ['nullable'],
            'week_number' => ['nullable', 'integer'],
            'exam_title' => ['required', 'string'],
            'exam_date' => ['required', 'date'],
            'exam_time' => ['required', 'string'],
            'duration_minutes' => ['required', 'integer'],
            'total_marks' => ['required', 'integer'],
            'negative_marking' => ['boolean'],
            'negative_marks_value' => ['nullable', 'numeric'],
            'reminder_enabled' => ['boolean'],
            'description' => ['nullable', 'string'],
            'exam_type_label' => ['nullable', 'string'],
        ]);

        $update = [
            'class_id' => $validated['class_id'],
            'syllabus_type' => $validated['syllabus_type'],
            'cycle_id' => $validated['cycle_id'] ?? null,
            'week_number' => $validated['week_number'] ?? null,
            'exam_title' => $validated['exam_title'],
            'exam_date' => $validated['exam_date'],
            'exam_time' => $validated['exam_time'],
            'duration_minutes' => $validated['duration_minutes'],
            'total_marks' => $validated['total_marks'],
            'negative_marking' => $validated['negative_marking'] ?? false,
            'negative_marks_value' => $validated['negative_marks_value'] ?? 0,
            'reminder_enabled' => $validated['reminder_enabled'] ?? false,
            'updated_at' => now(),
        ];
        if (Schema::hasColumn('weekly_exams', 'subject_id')) {
            $update['subject_id'] = $validated['subject_id'] ?? null;
        }
        if (Schema::hasColumn('weekly_exams', 'description')) {
            $update['description'] = $validated['description'] ?? null;
        }
        if (Schema::hasColumn('weekly_exams', 'exam_type_label')) {
            $update['exam_type_label'] = $validated['exam_type_label'] ?? null;
        }

        DB::table('weekly_exams')->where('id', $id)->update($update);

        return response()->json(['message' => 'Updated']);
    }

    public function updateWeeklyStatus(Request $request, int $id): JsonResponse
    {
        if (! Schema::hasTable('weekly_exams')) {
            return response()->json(['message' => 'weekly_exams table not found'], 422);
        }

        $validated = $request->validate(['status' => ['required', 'string']]);
        DB::table('weekly_exams')->where('id', $id)->update(['status' => $validated['status'], 'updated_at' => now()]);

        $exam = DB::table('weekly_exams')->where('id', $id)->first();
        if ($exam && ! empty($exam->class_id)) {
            $recipientIds = $this->classRecipientUserIds([(int) $exam->class_id]);
            app(NotificationService::class)->notifyUsers(
                $recipientIds,
                'Weekly exam status updated',
                'Weekly exam status is now '.$validated['status'],
                [
                    'type' => 'competitive_exam',
                    'link' => '/parent/exams',
                    'entity_type' => 'weekly_exam',
                    'entity_id' => $id,
                    'priority' => 'normal',
                    'channel' => 'both',
                ]
            );
        }

        return response()->json(['message' => 'Updated']);
    }

    public function deleteWeekly(int $id): JsonResponse
    {
        if (Schema::hasTable('weekly_exam_syllabus')) {
            DB::table('weekly_exam_syllabus')->where('exam_id', $id)->delete();
        }
        if (Schema::hasTable('weekly_exams')) {
            DB::table('weekly_exams')->where('id', $id)->delete();
        }
        return response()->json(['message' => 'Deleted']);
    }

    public function saveWeeklySyllabus(Request $request, int $id): JsonResponse
    {
        if (! Schema::hasTable('weekly_exam_syllabus')) {
            return response()->json(['message' => 'weekly_exam_syllabus table not found'], 422);
        }

        $validated = $request->validate([
            'syllabus_ids' => ['array'],
        ]);

        DB::table('weekly_exam_syllabus')->where('exam_id', $id)->delete();

        $ids = $validated['syllabus_ids'] ?? [];
        if (! empty($ids)) {
            $rows = collect($ids)->map(fn ($sid) => [
                'exam_id' => $id,
                'syllabus_id' => $sid,
            ])->all();
            DB::table('weekly_exam_syllabus')->insert($rows);
        }

        return response()->json(['message' => 'Saved']);
    }

    public function teacherExamsData(): JsonResponse
    {
        $classes = Schema::hasTable('classes')
            ? DB::table('classes')->select('id', 'name', 'section')->orderBy('name')->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'section' => $r->section,
            ])
            : collect();

        $students = Schema::hasTable('students')
            ? DB::table('students')->select('id', 'full_name', 'admission_number', 'class_id')->orderBy('full_name')->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'full_name' => $r->full_name,
                'admission_number' => $r->admission_number,
                'class_id' => $r->class_id ? (string) $r->class_id : '',
            ])
            : collect();

        $exams = collect();
        if (Schema::hasTable('exams')) {
            $exams = DB::table('exams')
                ->leftJoin('classes', 'classes.id', '=', 'exams.class_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'exams.subject_id')
                ->select(
                    'exams.id',
                    'exams.name',
                    'exams.max_marks',
                    'exams.exam_time',
                    'exams.class_id',
                    'exams.subject_id',
                    'exams.exam_date',
                    'classes.name as class_name',
                    'classes.section as class_section',
                    'subjects.name as subject_name'
                )
                ->orderByDesc('exams.exam_date')
                ->get()
                ->map(fn ($r) => [
                    'id' => (string) $r->id,
                    'name' => $r->name,
                    'max_marks' => $r->max_marks,
                    'class_id' => $r->class_id ? (string) $r->class_id : '',
                    'subject_id' => $r->subject_id ? (string) $r->subject_id : null,
                    'exam_date' => $r->exam_date,
                    'exam_time' => $r->exam_time,
                    'classes' => $r->class_name ? ['name' => $r->class_name, 'section' => $r->class_section] : null,
                    'subjects' => $r->subject_name ? ['name' => $r->subject_name] : null,
                ]);
        }

        return response()->json([
            'classes' => $classes,
            'students' => $students,
            'exams' => $exams,
        ]);
    }

    public function studentExamMarks(int $studentId): JsonResponse
    {
        if (! Schema::hasTable('exam_marks')) {
            return response()->json([]);
        }

        $rows = DB::table('exam_marks')
            ->leftJoin('exams', 'exams.id', '=', 'exam_marks.exam_id')
            ->leftJoin('subjects', 'subjects.id', '=', 'exams.subject_id')
            ->leftJoin('classes', 'classes.id', '=', 'exam_marks.class_id_snapshot')
            ->where('exam_marks.student_id', $studentId)
            ->select(
                'exam_marks.id',
                'exam_marks.marks_obtained',
                'exam_marks.grade',
                'exam_marks.remarks',
                'exams.name as exam_name',
                'exams.exam_date',
                'exams.max_marks',
                'subjects.name as subject_name',
                'exam_marks.class_id_snapshot',
                'exam_marks.class_name_snapshot',
                'exam_marks.class_section_snapshot',
                'classes.name as fallback_class_name',
                'classes.section as fallback_class_section'
            )
            ->orderByDesc('exam_marks.created_at')
            ->get()
            ->map(fn ($r) => [
                'id' => (string) $r->id,
                'marks_obtained' => $r->marks_obtained,
                'grade' => $r->grade,
                'remarks' => $r->remarks,
                'exams' => $r->exam_name ? [
                    'name' => $r->exam_name,
                    'exam_date' => $r->exam_date,
                    'max_marks' => $r->max_marks,
                    'class_id' => $r->class_id_snapshot ? (string) $r->class_id_snapshot : null,
                    'classes' => ($r->class_name_snapshot || $r->fallback_class_name) ? [
                        'id' => $r->class_id_snapshot ? (string) $r->class_id_snapshot : null,
                        'name' => $r->class_name_snapshot ?: $r->fallback_class_name,
                        'section' => $r->class_section_snapshot ?: $r->fallback_class_section,
                    ] : null,
                    'subjects' => $r->subject_name ? ['name' => $r->subject_name] : null,
                ] : null,
            ]);

        return response()->json($rows);
    }

    public function examMarksData(int $examId): JsonResponse
    {
        if (! Schema::hasTable('exams')) {
            return response()->json(['students' => [], 'marks' => []]);
        }

        $exam = DB::table('exams')->select('id', 'class_id')->where('id', $examId)->first();
        if (! $exam) {
            return response()->json(['students' => [], 'marks' => []]);
        }

        $students = Schema::hasTable('students')
            ? DB::table('students')
                ->select('id', 'full_name', 'admission_number', 'photo_url')
                ->where('class_id', $exam->class_id)
                ->orderBy('full_name')
                ->get()
                ->map(fn ($r) => [
                    'id' => (string) $r->id,
                    'full_name' => $r->full_name,
                    'admission_number' => $r->admission_number,
                    'photo_url' => $r->photo_url,
                ])
            : collect();

        $marks = Schema::hasTable('exam_marks')
            ? DB::table('exam_marks')
                ->select('student_id', 'marks_obtained', 'grade', 'remarks')
                ->where('exam_id', $examId)
                ->get()
                ->map(fn ($r) => [
                    'student_id' => (string) $r->student_id,
                    'marks_obtained' => $r->marks_obtained,
                    'grade' => $r->grade,
                    'remarks' => $r->remarks,
                ])
            : collect();

        return response()->json([
            'students' => $students,
            'marks' => $marks,
        ]);
    }

    public function saveExamMarks(Request $request, int $examId): JsonResponse
    {
        if (! Schema::hasTable('exam_marks')) {
            return response()->json(['message' => 'exam_marks table not found'], 422);
        }

        $validated = $request->validate([
            'records' => ['array'],
            'records.*.student_id' => ['required'],
            'records.*.marks_obtained' => ['nullable', 'numeric'],
            'records.*.grade' => ['nullable', 'string'],
            'records.*.remarks' => ['nullable', 'string'],
        ]);

        DB::table('exam_marks')->where('exam_id', $examId)->delete();

        $records = $validated['records'] ?? [];
        if (! empty($records)) {
            $examClass = DB::table('exams')
                ->leftJoin('classes', 'classes.id', '=', 'exams.class_id')
                ->where('exams.id', $examId)
                ->select('exams.class_id', 'classes.name as class_name', 'classes.section as class_section')
                ->first();

            $rows = collect($records)->map(fn ($r) => [
                'exam_id' => $examId,
                'student_id' => $r['student_id'],
                'class_id_snapshot' => $examClass->class_id ?? null,
                'class_name_snapshot' => $examClass->class_name ?? null,
                'class_section_snapshot' => $examClass->class_section ?? null,
                'marks_obtained' => $r['marks_obtained'] ?? null,
                'grade' => $r['grade'] ?? null,
                'remarks' => $r['remarks'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ])->all();
            DB::table('exam_marks')->insert($rows);
        }

        $exam = DB::table('exams')->where('id', $examId)->first();
        if ($exam && ! empty($exam->class_id)) {
            $recipientIds = $this->classRecipientUserIds([(int) $exam->class_id]);
            app(NotificationService::class)->notifyUsers(
                $recipientIds,
                'Exam marks published',
                'Marks have been published for an exam. Check results now.',
                [
                    'type' => 'result',
                    'link' => '/parent/exams',
                    'entity_type' => 'exam',
                    'entity_id' => $examId,
                    'priority' => 'high',
                    'channel' => 'both',
                ]
            );
        }

        return response()->json(['message' => 'Saved']);
    }

    public function weeklyExamMarksData(int $examId): JsonResponse
    {
        if (! Schema::hasTable('weekly_exams')) {
            return response()->json(['students' => [], 'marks' => []]);
        }

        $exam = DB::table('weekly_exams')->select('id', 'class_id', 'total_marks')->where('id', $examId)->first();
        if (! $exam) {
            return response()->json(['students' => [], 'marks' => []]);
        }

        $students = Schema::hasTable('students')
            ? DB::table('students')
                ->select('id', 'full_name', 'admission_number', 'photo_url')
                ->where('class_id', $exam->class_id)
                ->orderBy('full_name')
                ->get()
                ->map(fn ($r) => [
                    'id' => (string) $r->id,
                    'full_name' => $r->full_name,
                    'admission_number' => $r->admission_number,
                    'photo_url' => $r->photo_url,
                ])
            : collect();

        $marks = Schema::hasTable('student_exam_results')
            ? DB::table('student_exam_results')
                ->select('student_id', 'obtained_marks', 'percentage')
                ->where('exam_id', $examId)
                ->get()
                ->map(fn ($r) => [
                    'student_id' => (string) $r->student_id,
                    'obtained_marks' => $r->obtained_marks,
                    'percentage' => $r->percentage,
                ])
            : collect();

        return response()->json([
            'students' => $students,
            'marks' => $marks,
            'total_marks' => (int) ($exam->total_marks ?? 0),
        ]);
    }

    public function saveWeeklyExamMarks(Request $request, int $examId): JsonResponse
    {
        if (! Schema::hasTable('student_exam_results')) {
            return response()->json(['message' => 'student_exam_results table not found'], 422);
        }

        $validated = $request->validate([
            'records' => ['array'],
            'records.*.student_id' => ['required'],
            'records.*.obtained_marks' => ['nullable', 'numeric'],
            'records.*.percentage' => ['nullable', 'numeric'],
            'records.*.total_marks' => ['nullable', 'numeric'],
        ]);

        DB::table('student_exam_results')->where('exam_id', $examId)->delete();

        $records = $validated['records'] ?? [];
        if (! empty($records)) {
            $rows = collect($records)->map(fn ($r) => [
                'exam_id' => $examId,
                'student_id' => $r['student_id'],
                'obtained_marks' => $r['obtained_marks'] ?? 0,
                'total_marks' => $r['total_marks'] ?? null,
                'percentage' => $r['percentage'] ?? 0,
                'created_at' => now(),
                'updated_at' => now(),
            ])->all();
            DB::table('student_exam_results')->insert($rows);
        }

        $exam = DB::table('weekly_exams')->where('id', $examId)->first();
        if ($exam && ! empty($exam->class_id)) {
            $recipientIds = $this->classRecipientUserIds([(int) $exam->class_id]);
            app(NotificationService::class)->notifyUsers(
                $recipientIds,
                'Weekly exam results published',
                'Weekly exam results are available now.',
                [
                    'type' => 'result',
                    'link' => '/parent/exams',
                    'entity_type' => 'weekly_exam',
                    'entity_id' => $examId,
                    'priority' => 'high',
                    'channel' => 'both',
                ]
            );
        }

        return response()->json(['message' => 'Saved']);
    }

    public function examResultsData(): JsonResponse
    {
        $classes = Schema::hasTable('classes')
            ? DB::table('classes')->select('id', 'name', 'section')->orderBy('name')->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'section' => $r->section,
            ])
            : collect();

        $results = collect();
        if (Schema::hasTable('exam_marks')) {
            $results = DB::table('exam_marks')
                ->leftJoin('students', 'students.id', '=', 'exam_marks.student_id')
                ->leftJoin('exams', 'exams.id', '=', 'exam_marks.exam_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'exams.subject_id')
                ->leftJoin('classes', 'classes.id', '=', 'exam_marks.class_id_snapshot')
                ->select(
                    'exam_marks.id',
                    'exam_marks.marks_obtained',
                    'exam_marks.grade',
                    'exam_marks.remarks',
                    'exam_marks.student_id',
                    'exam_marks.exam_id',
                    'students.full_name as student_name',
                    'students.admission_number',
                    'students.class_id as student_class_id',
                    'exams.name as exam_name',
                    'exams.exam_date',
                    'exams.max_marks',
                    'exam_marks.class_id_snapshot as exam_class_id',
                    'subjects.name as subject_name',
                    'exam_marks.class_name_snapshot',
                    'exam_marks.class_section_snapshot',
                    'classes.name as fallback_class_name',
                    'classes.section as fallback_class_section'
                )
                ->orderByDesc('exam_marks.created_at')
                ->get()
                ->map(fn ($r) => [
                    'id' => (string) $r->id,
                    'marks_obtained' => $r->marks_obtained,
                    'grade' => $r->grade,
                    'remarks' => $r->remarks,
                    'student_id' => (string) $r->student_id,
                    'exam_id' => (string) $r->exam_id,
                    'students' => $r->student_name ? [
                        'full_name' => $r->student_name,
                        'admission_number' => $r->admission_number,
                        'class_id' => $r->student_class_id ? (string) $r->student_class_id : null,
                    ] : null,
                    'exams' => $r->exam_name ? [
                        'name' => $r->exam_name,
                        'exam_date' => $r->exam_date,
                        'max_marks' => $r->max_marks,
                        'class_id' => $r->exam_class_id ? (string) $r->exam_class_id : null,
                        'subjects' => $r->subject_name ? ['name' => $r->subject_name] : null,
                        'classes' => ($r->class_name_snapshot || $r->fallback_class_name) ? [
                            'name' => $r->class_name_snapshot ?: $r->fallback_class_name,
                            'section' => $r->class_section_snapshot ?: $r->fallback_class_section,
                        ] : null,
                    ] : null,
                ]);
        }

        $weeklyResults = Schema::hasTable('student_exam_results')
            ? DB::table('student_exam_results')
                ->leftJoin('students', 'students.id', '=', 'student_exam_results.student_id')
                ->leftJoin('weekly_exams', 'weekly_exams.id', '=', 'student_exam_results.exam_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'weekly_exams.subject_id')
                ->leftJoin('classes', 'classes.id', '=', 'weekly_exams.class_id')
                ->select(
                    'student_exam_results.id',
                    'student_exam_results.obtained_marks',
                    'student_exam_results.total_marks',
                    'student_exam_results.percentage',
                    'student_exam_results.rank',
                    'student_exam_results.student_id',
                    'student_exam_results.exam_id',
                    'students.full_name as student_name',
                    'students.admission_number',
                    'students.class_id as student_class_id',
                    'weekly_exams.exam_title',
                    'weekly_exams.exam_date',
                    'weekly_exams.total_marks as weekly_total_marks',
                    'weekly_exams.syllabus_type',
                    'weekly_exams.exam_type_label',
                    'weekly_exams.class_id as weekly_class_id',
                    'subjects.name as subject_name',
                    'classes.name as class_name',
                    'classes.section as class_section'
                )
                ->orderByDesc('student_exam_results.created_at')
                ->get()
                ->map(fn ($r) => [
                    'id' => (string) $r->id,
                    'obtained_marks' => $r->obtained_marks,
                    'total_marks' => $r->total_marks,
                    'percentage' => $r->percentage,
                    'rank' => $r->rank,
                    'student_id' => (string) $r->student_id,
                    'exam_id' => (string) $r->exam_id,
                    'students' => $r->student_name ? [
                        'full_name' => $r->student_name,
                        'admission_number' => $r->admission_number,
                        'class_id' => $r->student_class_id ? (string) $r->student_class_id : null,
                    ] : null,
                    'weekly_exams' => $r->exam_title ? [
                        'exam_title' => $r->exam_title,
                        'exam_date' => $r->exam_date,
                        'total_marks' => $r->weekly_total_marks,
                        'syllabus_type' => $r->syllabus_type,
                        'exam_type_label' => $r->exam_type_label,
                        'class_id' => $r->weekly_class_id ? (string) $r->weekly_class_id : null,
                        'subjects' => $r->subject_name ? ['name' => $r->subject_name] : null,
                        'classes' => $r->class_name ? ['name' => $r->class_name, 'section' => $r->class_section] : null,
                    ] : null,
                ])
            : collect();

        $allWeeklyExams = Schema::hasTable('weekly_exams')
            ? DB::table('weekly_exams')->select('id', 'exam_title', 'syllabus_type', 'class_id', 'exam_type_label')->orderByDesc('exam_date')->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'exam_title' => $r->exam_title,
                'syllabus_type' => $r->syllabus_type,
                'class_id' => (string) $r->class_id,
                'exam_type_label' => $r->exam_type_label,
            ])
            : collect();

        return response()->json([
            'results' => $results,
            'weeklyResults' => $weeklyResults,
            'classes' => $classes,
            'allWeeklyExams' => $allWeeklyExams,
        ]);
    }

    private function normalizeExamTime(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $raw = trim((string) $value);

        if (str_contains($raw, '-')) {
            $raw = trim(explode('-', $raw)[0]);
        }

        if (preg_match('/^\d{1,2}:\d{2}$/', $raw) === 1) {
            return $raw.':00';
        }

        if (preg_match('/^\d{1,2}:\d{2}:\d{2}$/', $raw) === 1) {
            return $raw;
        }

        return null;
    }

    private function classRecipientUserIds(array $classIds): array
    {
        $classIds = collect($classIds)
            ->filter(fn ($v) => is_numeric($v) && (int) $v > 0)
            ->map(fn ($v) => (int) $v)
            ->unique()
            ->values()
            ->all();

        if (empty($classIds)) {
            return [];
        }

        $teacherUserIds = DB::table('classes')
            ->leftJoin('teachers', 'teachers.id', '=', 'classes.class_teacher_id')
            ->whereIn('classes.id', $classIds)
            ->whereNotNull('teachers.user_id')
            ->pluck('teachers.user_id')
            ->map(fn ($v) => (int) $v)
            ->all();

        $parentUserIds = DB::table('students')
            ->join('student_parents', 'student_parents.student_id', '=', 'students.id')
            ->join('parents', 'parents.id', '=', 'student_parents.parent_id')
            ->whereIn('students.class_id', $classIds)
            ->pluck('parents.user_id')
            ->map(fn ($v) => (int) $v)
            ->all();

        return array_values(array_unique(array_merge($teacherUserIds, $parentUserIds)));
    }
}
