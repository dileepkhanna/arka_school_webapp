<?php

namespace App\Http\Controllers\Api;

use App\Support\HandlesUploadStorage;
use App\Http\Controllers\Controller;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class ParentPortalController extends Controller
{
    use HandlesUploadStorage;

    private function resolveParentStudent(int $userId): ?object
    {
        $parent = DB::table('parents')->where('user_id', $userId)->first();
        if (! $parent) {
            return null;
        }

        return DB::table('student_parents')
            ->leftJoin('students', 'students.id', '=', 'student_parents.student_id')
            ->leftJoin('classes', 'classes.id', '=', 'students.class_id')
            ->where('student_parents.parent_id', $parent->id)
            ->select(
                'student_parents.student_id',
                'students.full_name',
                'students.admission_number',
                'students.class_id',
                'classes.name as class_name',
                'classes.section as class_section'
            )
            ->first();
    }

    public function dashboard(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $today = now()->toDateString();

        $parent = DB::table('parents')->where('user_id', $userId)->first();
        if (! $parent) {
            return response()->json([
                'children' => [],
                'announcements' => [],
                'upcomingCompExams' => [],
                'todayExams' => [],
                'pendingHomework' => 0,
                'upcomingExamCount' => 0,
                'pendingFees' => 0,
            ]);
        }

        $studentIds = DB::table('student_parents')->where('parent_id', $parent->id)->pluck('student_id')->all();
        $children = empty($studentIds)
            ? collect()
            : DB::table('students')
                ->leftJoin('classes', 'classes.id', '=', 'students.class_id')
                ->whereIn('students.id', $studentIds)
                ->select(
                    'students.id', 'students.full_name', 'students.admission_number', 'students.photo_url',
                    'students.status', 'students.class_id',
                    'classes.name as class_name', 'classes.section as class_section'
                )
                ->get()
                ->map(fn ($r) => [
                    'id' => (string) $r->id,
                    'full_name' => $r->full_name,
                    'admission_number' => $r->admission_number,
                    'photo_url' => $r->photo_url,
                    'status' => $r->status,
                    'class_id' => $r->class_id ? (string) $r->class_id : null,
                    'classes' => $r->class_name ? ['name' => $r->class_name, 'section' => $r->class_section] : null,
                ]);

        $classIds = $children->pluck('class_id')->filter()->values()->all();

        $announcements = Schema::hasTable('announcements')
            ? DB::table('announcements')->orderByDesc('created_at')->limit(4)->get()
            : collect();

        $upcomingCompExams = collect();
        if (Schema::hasTable('weekly_exams')) {
            $upcomingCompExamsQuery = DB::table('weekly_exams')
                ->leftJoin('classes', 'classes.id', '=', 'weekly_exams.class_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'weekly_exams.subject_id')
                ->where('weekly_exams.syllabus_type', 'competitive')
                ->whereDate('weekly_exams.exam_date', '>=', $today)
                ->select(
                    'weekly_exams.id', 'weekly_exams.exam_title', 'weekly_exams.exam_date', 'weekly_exams.exam_time',
                    'weekly_exams.total_marks', 'weekly_exams.exam_type_label',
                    'classes.name as class_name', 'classes.section as class_section', 'subjects.name as subject_name'
                )
                ->orderBy('weekly_exams.exam_date')
                ->limit(1);
            if (! empty($classIds)) {
                $upcomingCompExamsQuery->whereIn('weekly_exams.class_id', $classIds);
            }
            $upcomingCompExams = $upcomingCompExamsQuery->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'exam_title' => $r->exam_title,
                'exam_date' => $r->exam_date,
                'exam_time' => $r->exam_time,
                'total_marks' => $r->total_marks,
                'exam_type_label' => $r->exam_type_label,
                'classes' => $r->class_name ? ['name' => $r->class_name, 'section' => $r->class_section] : null,
                'subjects' => $r->subject_name ? ['name' => $r->subject_name] : null,
            ]);
        }

        $todayExams = collect();
        if (Schema::hasTable('exams')) {
            $todayExamsQuery = DB::table('exams')
                ->leftJoin('classes', 'classes.id', '=', 'exams.class_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'exams.subject_id')
                ->whereDate('exams.exam_date', '>=', $today)
                ->select(
                    'exams.id', 'exams.name', 'exams.exam_date', 'exams.exam_time', 'exams.max_marks',
                    'classes.name as class_name', 'classes.section as class_section', 'subjects.name as subject_name'
                )
                ->orderBy('exams.exam_date')
                ->orderBy('exams.exam_time')
                ->limit(5);
            if (! empty($classIds)) {
                $todayExamsQuery->whereIn('exams.class_id', $classIds);
            }
            $todayExams = $todayExamsQuery->get()->map(fn ($r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'exam_date' => $r->exam_date,
                'exam_time' => $r->exam_time,
                'max_marks' => $r->max_marks,
                'classes' => $r->class_name ? ['name' => $r->class_name, 'section' => $r->class_section] : null,
                'subjects' => $r->subject_name ? ['name' => $r->subject_name] : null,
            ]);
        }

        $pendingHomework = empty($classIds)
            ? 0
            : (Schema::hasTable('homework')
                ? DB::table('homework')->whereIn('class_id', $classIds)->whereDate('due_date', '>=', $today)->count()
                : 0);

        $pendingFees = empty($studentIds)
            ? 0
            : (Schema::hasTable('fees')
                ? DB::table('fees')->whereIn('student_id', $studentIds)->where('payment_status', 'unpaid')->count()
                : 0);

        return response()->json([
            'children' => $children,
            'announcements' => $announcements,
            'upcomingCompExams' => $upcomingCompExams,
            'todayExams' => $todayExams,
            'pendingHomework' => $pendingHomework,
            'upcomingExamCount' => $todayExams->count(),
            'pendingFees' => $pendingFees,
        ]);
    }

    public function exams(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $parent = DB::table('parents')->where('user_id', $userId)->first();
        if (! $parent) {
            return response()->json([
                'childName' => '',
                'childClassIds' => [],
                'marks' => [],
                'weeklyResults' => [],
            ]);
        }

        $links = DB::table('student_parents')
            ->leftJoin('students', 'students.id', '=', 'student_parents.student_id')
            ->where('student_parents.parent_id', $parent->id)
            ->select('student_parents.student_id', 'students.full_name', 'students.class_id')
            ->get();

        if ($links->isEmpty()) {
            return response()->json([
                'childName' => '',
                'childClassIds' => [],
                'marks' => [],
                'weeklyResults' => [],
            ]);
        }

        $studentId = $links->first()->student_id;
        $childName = $links->first()->full_name ?? '';
        $childClassIds = $links->pluck('class_id')->filter()->map(fn ($id) => (string) $id)->values()->all();

        $marks = collect();
        if (Schema::hasTable('exam_marks') && Schema::hasTable('exams')) {
            $marks = DB::table('exam_marks')
                ->leftJoin('exams', 'exams.id', '=', 'exam_marks.exam_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'exams.subject_id')
                ->leftJoin('classes', 'classes.id', '=', 'exam_marks.class_id_snapshot')
                ->where('exam_marks.student_id', $studentId)
                ->select(
                    'exam_marks.id', 'exam_marks.marks_obtained', 'exam_marks.grade', 'exam_marks.remarks',
                    'exams.name as exam_name', 'exams.exam_date', 'exams.max_marks', 'subjects.name as subject_name',
                    'exam_marks.class_id_snapshot', 'exam_marks.class_name_snapshot', 'exam_marks.class_section_snapshot',
                    'classes.name as fallback_class_name', 'classes.section as fallback_class_section'
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
        }

        $weeklyResults = collect();
        if (Schema::hasTable('student_exam_results') && Schema::hasTable('weekly_exams')) {
            $weeklyResults = DB::table('student_exam_results')
                ->leftJoin('weekly_exams', 'weekly_exams.id', '=', 'student_exam_results.exam_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'weekly_exams.subject_id')
                ->leftJoin('classes', 'classes.id', '=', 'weekly_exams.class_id')
                ->where('student_exam_results.student_id', $studentId)
                ->select(
                    'student_exam_results.id', 'student_exam_results.obtained_marks', 'student_exam_results.total_marks',
                    'student_exam_results.percentage', 'student_exam_results.rank', 'student_exam_results.exam_id',
                    'weekly_exams.exam_title', 'weekly_exams.exam_date', 'weekly_exams.total_marks as weekly_total_marks',
                    'weekly_exams.syllabus_type', 'weekly_exams.exam_type_label',
                    'subjects.name as subject_name', 'classes.name as class_name', 'classes.section as class_section'
                )
                ->orderByDesc('student_exam_results.created_at')
                ->get()
                ->map(fn ($r) => [
                    'id' => (string) $r->id,
                    'obtained_marks' => $r->obtained_marks,
                    'total_marks' => $r->total_marks,
                    'percentage' => $r->percentage,
                    'rank' => $r->rank,
                    'exam_id' => (string) $r->exam_id,
                    'weekly_exams' => $r->exam_title ? [
                        'exam_title' => $r->exam_title,
                        'exam_date' => $r->exam_date,
                        'total_marks' => $r->weekly_total_marks,
                        'syllabus_type' => $r->syllabus_type,
                        'exam_type_label' => $r->exam_type_label,
                        'subjects' => $r->subject_name ? ['name' => $r->subject_name] : null,
                        'classes' => $r->class_name ? ['name' => $r->class_name, 'section' => $r->class_section] : null,
                    ] : null,
                ]);
        }

        return response()->json([
            'childName' => $childName,
            'childClassIds' => $childClassIds,
            'marks' => $marks,
            'weeklyResults' => $weeklyResults,
        ]);
    }

    public function attendance(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student) {
            return response()->json([
                'student_id' => null,
                'childName' => '',
                'admissionNo' => '',
                'childClass' => '',
                'attendance' => [],
            ]);
        }

        $startDate = $validated['start_date'] ?? now()->subMonths(6)->startOfMonth()->toDateString();
        $endDate = $validated['end_date'] ?? now()->endOfMonth()->toDateString();

        if (! Schema::hasTable('attendance')) {
            return response()->json([
                'student_id' => (string) $student->student_id,
                'childName' => $student->full_name ?? '',
                'admissionNo' => $student->admission_number ?? '',
                'childClass' => $student->class_name ? $student->class_name.'-'.$student->class_section : '',
                'attendance' => [],
            ]);
        }

        $selectColumns = ['id', 'date', 'status'];
        $hasSession = Schema::hasColumn('attendance', 'session');
        $hasReason = Schema::hasColumn('attendance', 'reason');
        if ($hasSession) {
            $selectColumns[] = 'session';
        }
        if ($hasReason) {
            $selectColumns[] = 'reason';
        }

        $attendance = DB::table('attendance')
            ->select(array_merge($selectColumns, [
                'class_id_snapshot',
                'class_name_snapshot',
                'class_section_snapshot',
            ]))
            ->where('student_id', $student->student_id)
            ->whereDate('date', '>=', $startDate)
            ->whereDate('date', '<=', $endDate)
            ->orderByDesc('date')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'date' => $row->date,
                'status' => $row->status,
                'session' => $hasSession ? ($row->session ?? null) : null,
                'reason' => $hasReason ? ($row->reason ?? null) : null,
                'class_id_snapshot' => $row->class_id_snapshot !== null ? (string) $row->class_id_snapshot : null,
                'classes' => $row->class_name_snapshot ? [
                    'id' => $row->class_id_snapshot !== null ? (string) $row->class_id_snapshot : null,
                    'name' => $row->class_name_snapshot,
                    'section' => $row->class_section_snapshot,
                ] : null,
            ]);

        return response()->json([
            'student_id' => (string) $student->student_id,
            'childName' => $student->full_name ?? '',
            'admissionNo' => $student->admission_number ?? '',
            'childClass' => $student->class_name ? $student->class_name.'-'.$student->class_section : '',
            'attendance' => $attendance,
        ]);
    }

    public function homework(Request $request): JsonResponse
    {
        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student || ! $student->class_id) {
            return response()->json(['homework' => []]);
        }

        if (! Schema::hasTable('homework')) {
            return response()->json(['homework' => []]);
        }

        $homework = DB::table('homework')
            ->leftJoin('subjects', 'subjects.id', '=', 'homework.subject_id')
            ->where('homework.class_id', $student->class_id)
            ->select(
                'homework.id',
                'homework.title',
                'homework.description',
                'homework.due_date',
                'homework.attachment_url',
                'homework.created_at',
                'subjects.name as subject_name'
            )
            ->orderBy('homework.due_date')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'title' => $row->title,
                'description' => $row->description,
                'due_date' => $row->due_date,
                'attachment_url' => $this->normalizeLegacyAttachmentUrl($row->attachment_url),
                'created_at' => $row->created_at,
                'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
            ]);

        return response()->json(['homework' => $homework]);
    }

    public function children(Request $request): JsonResponse
    {
        $parent = DB::table('parents')->where('user_id', $request->user()->id)->first();
        if (! $parent) {
            return response()->json(['children' => []]);
        }

        $studentIds = DB::table('student_parents')->where('parent_id', $parent->id)->pluck('student_id')->all();
        if (empty($studentIds)) {
            return response()->json(['children' => []]);
        }

        $children = DB::table('students')
            ->leftJoin('classes', 'classes.id', '=', 'students.class_id')
            ->whereIn('students.id', $studentIds)
            ->select(
                'students.id',
                'students.full_name',
                'students.admission_number',
                'students.photo_url',
                'students.status',
                'students.date_of_birth',
                'students.blood_group',
                'students.address',
                'students.parent_name',
                'students.parent_phone',
                'students.emergency_contact',
                'students.emergency_contact_name',
                'classes.name as class_name',
                'classes.section as class_section'
            )
            ->orderBy('students.full_name')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'full_name' => $row->full_name,
                'admission_number' => $row->admission_number,
                'photo_url' => $row->photo_url,
                'status' => $row->status,
                'date_of_birth' => $row->date_of_birth,
                'blood_group' => $row->blood_group,
                'address' => $row->address,
                'parent_name' => $row->parent_name,
                'parent_phone' => $row->parent_phone,
                'emergency_contact' => $row->emergency_contact,
                'emergency_contact_name' => $row->emergency_contact_name,
                'classes' => $row->class_name ? ['name' => $row->class_name, 'section' => $row->class_section] : null,
            ]);

        return response()->json(['children' => $children]);
    }

    public function progress(Request $request): JsonResponse
    {
        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student) {
            return response()->json([
                'childName' => '',
                'reports' => [],
                'marks' => [],
                'attendance' => ['total' => 0, 'present' => 0, 'absent' => 0, 'late' => 0],
            ]);
        }

        $studentId = $student->student_id;

        $reports = collect();
        if (Schema::hasTable('student_reports')) {
            $reportQuery = DB::table('student_reports')
                ->select('id', 'category', 'description', 'severity', 'created_at')
                ->where('student_id', $studentId)
                ->orderByDesc('created_at');

            if (Schema::hasColumn('student_reports', 'parent_visible')) {
                $reportQuery->where('parent_visible', true);
            }

            $reports = $reportQuery->get()->map(fn ($row) => [
                'id' => (string) $row->id,
                'category' => $row->category,
                'description' => $row->description,
                'severity' => $row->severity,
                'created_at' => $row->created_at,
            ]);
        }

        $marks = collect();
        if (Schema::hasTable('exam_marks') && Schema::hasTable('exams')) {
            $marks = DB::table('exam_marks')
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
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'marks_obtained' => $row->marks_obtained,
                    'grade' => $row->grade,
                    'remarks' => $row->remarks,
                    'exams' => $row->exam_name ? [
                        'name' => $row->exam_name,
                        'exam_date' => $row->exam_date,
                        'max_marks' => $row->max_marks,
                        'class_id' => $row->class_id_snapshot ? (string) $row->class_id_snapshot : null,
                        'classes' => ($row->class_name_snapshot || $row->fallback_class_name) ? [
                            'id' => $row->class_id_snapshot ? (string) $row->class_id_snapshot : null,
                            'name' => $row->class_name_snapshot ?: $row->fallback_class_name,
                            'section' => $row->class_section_snapshot ?: $row->fallback_class_section,
                        ] : null,
                        'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                    ] : null,
                ]);
        }

        $attendanceRows = Schema::hasTable('attendance')
            ? DB::table('attendance')
                ->select('status')
                ->where('student_id', $studentId)
                ->get()
            : collect();

        $attendanceSummary = [
            'total' => $attendanceRows->count(),
            'present' => $attendanceRows->where('status', 'present')->count(),
            'absent' => $attendanceRows->where('status', 'absent')->count(),
            'late' => $attendanceRows->where('status', 'late')->count(),
        ];

        return response()->json([
            'childName' => $student->full_name ?? '',
            'reports' => $reports,
            'marks' => $marks,
            'attendance' => $attendanceSummary,
        ]);
    }

    public function timetable(Request $request): JsonResponse
    {
        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student || ! $student->class_id || ! Schema::hasTable('timetable')) {
            return response()->json([
                'childClass' => '',
                'timetable' => [],
            ]);
        }

        $rows = DB::table('timetable')
            ->leftJoin('subjects', 'subjects.id', '=', 'timetable.subject_id')
            ->leftJoin('teachers', 'teachers.id', '=', 'timetable.teacher_id')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
            ->leftJoin('periods', 'periods.id', '=', 'timetable.period_id')
            ->where('timetable.class_id', $student->class_id)
            ->where('timetable.is_published', true)
            ->select(
                'timetable.id',
                'timetable.day_of_week',
                'timetable.period_number',
                DB::raw('COALESCE(periods.start_time, timetable.start_time) as start_time'),
                DB::raw('COALESCE(periods.end_time, timetable.end_time) as end_time'),
                'subjects.name as subject_name',
                'profiles.full_name as teacher_name',
                'periods.label as period_label',
                'periods.type as period_type'
            )
            ->orderByRaw("FIELD(timetable.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')")
            ->orderBy('periods.period_number')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'day_of_week' => $row->day_of_week,
                'period_number' => (int) $row->period_number,
                'period_label' => $row->period_label,
                'period_type' => $row->period_type,
                'start_time' => $row->start_time,
                'end_time' => $row->end_time,
                'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                'teacherName' => $row->teacher_name,
            ]);

        if ($rows->isEmpty()) {
            $rows = DB::table('timetable')
                ->leftJoin('subjects', 'subjects.id', '=', 'timetable.subject_id')
                ->leftJoin('teachers', 'teachers.id', '=', 'timetable.teacher_id')
                ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
                ->leftJoin('periods', 'periods.id', '=', 'timetable.period_id')
                ->where('timetable.class_id', 0)
                ->where('timetable.is_published', true)
                ->select(
                    'timetable.id',
                    'timetable.day_of_week',
                    'timetable.period_number',
                    DB::raw('COALESCE(periods.start_time, timetable.start_time) as start_time'),
                    DB::raw('COALESCE(periods.end_time, timetable.end_time) as end_time'),
                    'subjects.name as subject_name',
                    'profiles.full_name as teacher_name',
                    'periods.label as period_label',
                    'periods.type as period_type'
                )
                ->orderByRaw("FIELD(timetable.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')")
                ->orderBy('periods.period_number')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'day_of_week' => $row->day_of_week,
                    'period_number' => (int) $row->period_number,
                    'period_label' => $row->period_label,
                    'period_type' => $row->period_type,
                    'start_time' => $row->start_time,
                    'end_time' => $row->end_time,
                    'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                    'teacherName' => $row->teacher_name,
                ]);

            $rows = $this->applyClassPeriodOverrides($rows, (int) $student->class_id);
        }

        return response()->json([
            'childClass' => $student->class_name ? $student->class_name.' - '.$student->class_section : '',
            'timetable' => $rows,
        ]);
    }

    public function syllabus(Request $request): JsonResponse
    {
        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student || ! Schema::hasTable('syllabus')) {
            return response()->json([
                'childName' => '',
                'syllabus' => [],
                'teacherMap' => [],
                'completedByNames' => [],
            ]);
        }

        $classId = $student->class_id;
        if (! $classId) {
            return response()->json([
                'childName' => $student->full_name ?? '',
                'syllabus' => [],
                'teacherMap' => [],
                'completedByNames' => [],
            ]);
        }

        $syllabusRows = DB::table('syllabus')
            ->leftJoin('subjects', 'subjects.id', '=', 'syllabus.subject_id')
            ->leftJoin('classes', 'classes.id', '=', 'syllabus.class_id')
            ->where('syllabus.class_id', $classId)
            ->select(
                'syllabus.id',
                'syllabus.chapter_name',
                'syllabus.topic_name',
                'syllabus.syllabus_type',
                'syllabus.exam_type',
                'syllabus.week_number',
                'syllabus.schedule_date',
                'syllabus.schedule_time',
                'syllabus.start_date',
                'syllabus.end_date',
                'syllabus.completed_at',
                'syllabus.completed_by',
                'subjects.name as subject_name',
                'classes.name as class_name',
                'classes.section as class_section'
            )
            ->orderBy('syllabus.chapter_name')
            ->get();

        $syllabus = $syllabusRows->map(fn ($row) => [
            'id' => (string) $row->id,
            'chapter_name' => $row->chapter_name,
            'topic_name' => $row->topic_name,
            'syllabus_type' => $row->syllabus_type,
            'exam_type' => $row->exam_type,
            'week_number' => $row->week_number ? (int) $row->week_number : null,
            'schedule_date' => $row->schedule_date,
            'schedule_time' => $row->schedule_time,
            'start_date' => $row->start_date,
            'end_date' => $row->end_date,
            'completed_at' => $row->completed_at,
            'completed_by' => $row->completed_by ? (string) $row->completed_by : null,
            'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
            'classes' => $row->class_name ? ['name' => $row->class_name, 'section' => $row->class_section] : null,
        ]);

        $syllabusIds = $syllabusRows->pluck('id')->all();
        $teacherMap = [];
        if (! empty($syllabusIds) && Schema::hasTable('teacher_syllabus_map')) {
            $maps = DB::table('teacher_syllabus_map')
                ->leftJoin('teachers', 'teachers.id', '=', 'teacher_syllabus_map.teacher_id')
                ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
                ->whereIn('teacher_syllabus_map.syllabus_id', $syllabusIds)
                ->select(
                    'teacher_syllabus_map.syllabus_id',
                    'teacher_syllabus_map.role_type',
                    'profiles.full_name as teacher_name'
                )
                ->get();

            foreach ($maps as $map) {
                $key = (string) $map->syllabus_id;
                if (! array_key_exists($key, $teacherMap)) {
                    $teacherMap[$key] = [];
                }
                $teacherMap[$key][] = [
                    'name' => $map->teacher_name ?: 'Teacher',
                    'role' => $map->role_type,
                ];
            }
        }

        $completedByNames = [];
        $completedByIds = $syllabusRows->pluck('completed_by')->filter()->unique()->values()->all();
        if (! empty($completedByIds)) {
            $profiles = DB::table('profiles')
                ->whereIn('user_id', $completedByIds)
                ->select('user_id', 'full_name')
                ->get();
            foreach ($profiles as $profile) {
                $completedByNames[(string) $profile->user_id] = $profile->full_name;
            }
        }

        return response()->json([
            'childName' => $student->full_name ?? '',
            'syllabus' => $syllabus,
            'teacherMap' => $teacherMap,
            'completedByNames' => $completedByNames,
        ]);
    }

    public function fees(Request $request): JsonResponse
    {
        $parent = DB::table('parents')->where('user_id', $request->user()->id)->first();
        if (! $parent) {
            return response()->json(['children' => []]);
        }

        $studentIds = DB::table('student_parents')->where('parent_id', $parent->id)->pluck('student_id')->all();
        if (empty($studentIds)) {
            return response()->json(['children' => []]);
        }

        $students = DB::table('students')
            ->leftJoin('classes', 'classes.id', '=', 'students.class_id')
            ->whereIn('students.id', $studentIds)
            ->select(
                'students.id',
                'students.full_name',
                'students.admission_number',
                'students.login_id',
                'classes.name as class_name',
                'classes.section as class_section'
            )
            ->get();

        $fees = Schema::hasTable('fees')
            ? DB::table('fees')
                ->leftJoin('classes', 'classes.id', '=', 'fees.assigned_class_id')
                ->whereIn('fees.student_id', $studentIds)
                ->select('fees.*', 'classes.id as assigned_class_ref', 'classes.name as assigned_class_name', 'classes.section as assigned_class_section')
                ->orderByDesc('due_date')
                ->get()
            : collect();

        $paymentsByStudent = [];
        if (Schema::hasTable('fee_payments')) {
            $payments = DB::table('fee_payments')
                ->whereIn('student_id', $studentIds)
                ->orderByDesc('paid_at')
                ->get();

            foreach ($payments as $payment) {
                $key = (string) $payment->student_id;
                if (! array_key_exists($key, $paymentsByStudent)) {
                    $paymentsByStudent[$key] = [];
                }
                $paymentsByStudent[$key][] = [
                    'id' => (string) $payment->id,
                    'amount' => (float) $payment->amount,
                    'payment_method' => $payment->payment_method,
                    'receipt_number' => $payment->receipt_number,
                    'paid_at' => $payment->paid_at,
                    'fee_id' => (string) $payment->fee_id,
                ];
            }
        }

        $children = $students->map(function ($student) use ($fees, $paymentsByStudent) {
            $studentFeeRows = $fees->where('student_id', $student->id)->values();

            return [
                'id' => (string) $student->id,
                'name' => $student->full_name,
                'admission_number' => $student->admission_number,
                'login_id' => $student->login_id,
                'class_name' => $student->class_name,
                'class_section' => $student->class_section,
                'fees' => $studentFeeRows->map(fn ($fee) => [
                    'id' => (string) $fee->id,
                    'fee_type' => $fee->fee_type,
                    'amount' => (float) $fee->amount,
                    'paid_amount' => $fee->paid_amount !== null ? (float) $fee->paid_amount : null,
                    'due_date' => $fee->due_date,
                    'payment_status' => $fee->payment_status,
                    'paid_at' => $fee->paid_at,
                    'receipt_number' => $fee->receipt_number,
                    'discount' => $fee->discount !== null ? (float) $fee->discount : null,
                    'assigned_class_id' => $fee->assigned_class_id !== null ? (string) $fee->assigned_class_id : null,
                    'assigned_class' => $fee->assigned_class_name ? [
                        'id' => (string) $fee->assigned_class_ref,
                        'name' => $fee->assigned_class_name,
                        'section' => $fee->assigned_class_section,
                    ] : null,
                ]),
                'payments' => $paymentsByStudent[(string) $student->id] ?? [],
            ];
        })->values();

        return response()->json(['children' => $children]);
    }

    public function paymentGatewayConfig(Request $request): JsonResponse
    {
        $settings = $this->paymentGatewaySettings();

        return response()->json([
            'provider' => 'razorpay',
            'configured' => $settings['configured'],
            'key_id' => $settings['key_id'],
        ]);
    }

    public function createFeePaymentOrder(Request $request, int $id): JsonResponse
    {
        if (! Schema::hasTable('fees')) {
            return response()->json(['message' => 'fees table not found'], 422);
        }

        if (! Schema::hasTable('fee_payment_orders')) {
            return response()->json(['message' => 'fee_payment_orders table not found'], 422);
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
        ]);

        $settings = $this->paymentGatewaySettings();
        if (! $settings['configured']) {
            return response()->json(['message' => 'Razorpay is not configured'], 422);
        }

        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student) {
            return response()->json(['message' => 'Linked student not found'], 404);
        }

        $fee = DB::table('fees')->where('id', $id)->where('student_id', $student->student_id)->first();
        if (! $fee) {
            return response()->json(['message' => 'Fee not found'], 404);
        }

        $netAmount = (float) $fee->amount - (float) ($fee->discount ?? 0);
        $alreadyPaid = (float) ($fee->paid_amount ?? 0);
        $remaining = max(0, $netAmount - $alreadyPaid);
        $payAmount = (float) $validated['amount'];

        if ($payAmount > $remaining) {
            return response()->json(['message' => 'Amount exceeds remaining balance'], 422);
        }

        $orderAmountPaise = (int) round($payAmount * 100);
        $orderReceipt = 'fee-'.$fee->id.'-'.now()->format('YmdHis').'-'.random_int(1000, 9999);

        $orderResponse = Http::withBasicAuth($settings['key_id'], $settings['key_secret'])
            ->acceptJson()
            ->post('https://api.razorpay.com/v1/orders', [
                'amount' => $orderAmountPaise,
                'currency' => 'INR',
                'receipt' => $orderReceipt,
                'notes' => [
                    'fee_id' => (string) $fee->id,
                    'student_id' => (string) $student->student_id,
                    'parent_user_id' => (string) $request->user()->id,
                ],
            ]);

        if (! $orderResponse->successful()) {
            return response()->json([
                'message' => 'Failed to create Razorpay order',
                'details' => $orderResponse->json(),
            ], 422);
        }

        $order = $orderResponse->json();

        DB::table('fee_payment_orders')->updateOrInsert(
            ['razorpay_order_id' => $order['id']],
            [
                'fee_id' => $fee->id,
                'student_id' => $student->student_id,
                'parent_user_id' => $request->user()->id,
                'amount' => $payAmount,
                'currency' => 'INR',
                'status' => 'created',
                'order_payload' => json_encode($order),
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        return response()->json([
            'provider' => 'razorpay',
            'key_id' => $settings['key_id'],
            'order_id' => $order['id'],
            'amount' => $payAmount,
            'amount_paise' => $orderAmountPaise,
            'currency' => 'INR',
            'student_name' => $student->full_name,
            'description' => $fee->fee_type.' fee payment',
            'fee_id' => (int) $fee->id,
        ]);
    }

    public function verifyFeePayment(Request $request, int $id): JsonResponse
    {
        if (! Schema::hasTable('fees')) {
            return response()->json(['message' => 'fees table not found'], 422);
        }

        if (! Schema::hasTable('fee_payment_orders')) {
            return response()->json(['message' => 'fee_payment_orders table not found'], 422);
        }

        $validated = $request->validate([
            'razorpay_order_id' => ['required', 'string'],
            'razorpay_payment_id' => ['required', 'string'],
            'razorpay_signature' => ['required', 'string'],
        ]);

        $settings = $this->paymentGatewaySettings();
        if (! $settings['configured']) {
            return response()->json(['message' => 'Razorpay is not configured'], 422);
        }

        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student) {
            return response()->json(['message' => 'Linked student not found'], 404);
        }

        $order = DB::table('fee_payment_orders')
            ->where('razorpay_order_id', $validated['razorpay_order_id'])
            ->where('fee_id', $id)
            ->where('parent_user_id', $request->user()->id)
            ->first();

        if (! $order) {
            return response()->json(['message' => 'Payment order not found'], 404);
        }

        if ($order->status === 'paid') {
            return response()->json(['message' => 'Payment already verified'], 200);
        }

        $expectedSignature = hash_hmac(
            'sha256',
            $validated['razorpay_order_id'].'|'.$validated['razorpay_payment_id'],
            $settings['key_secret']
        );

        if (! hash_equals($expectedSignature, $validated['razorpay_signature'])) {
            DB::table('fee_payment_orders')
                ->where('id', $order->id)
                ->update([
                    'status' => 'failed',
                    'verification_payload' => json_encode($validated),
                    'updated_at' => now(),
                ]);

            return response()->json(['message' => 'Invalid payment signature'], 422);
        }

        $payAmount = (float) $order->amount;

        $result = DB::transaction(function () use ($id, $student, $payAmount, $validated, $order, $request) {
            $fee = DB::table('fees')
                ->where('id', $id)
                ->where('student_id', $student->student_id)
                ->lockForUpdate()
                ->first();

            if (! $fee) {
                return ['error' => 'Fee not found', 'code' => 404];
            }

            $netAmount = (float) $fee->amount - (float) ($fee->discount ?? 0);
            $alreadyPaid = (float) ($fee->paid_amount ?? 0);
            $remaining = max(0, $netAmount - $alreadyPaid);

            if ($payAmount > $remaining) {
                return ['error' => 'Amount exceeds remaining balance', 'code' => 422];
            }

            $newPaidAmount = $alreadyPaid + $payAmount;
            $isFullyPaid = $newPaidAmount >= $netAmount;
            $receiptNumber = 'RZP-'.$validated['razorpay_payment_id'];
            $paidAt = now();

            DB::table('fees')->where('id', $id)->update([
                'paid_amount' => $newPaidAmount,
                'payment_status' => $isFullyPaid ? 'paid' : 'partial',
                'paid_at' => $paidAt,
                'receipt_number' => $receiptNumber,
                'updated_at' => now(),
            ]);

            if (Schema::hasTable('fee_payments')) {
                DB::table('fee_payments')->insert([
                    'fee_id' => $fee->id,
                    'student_id' => $fee->student_id,
                    'amount' => $payAmount,
                    'payment_method' => 'razorpay',
                    'receipt_number' => $receiptNumber,
                    'paid_at' => $paidAt,
                    'recorded_by' => $request->user()->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('fee_payment_orders')
                ->where('id', $order->id)
                ->update([
                    'status' => 'paid',
                    'razorpay_payment_id' => $validated['razorpay_payment_id'],
                    'razorpay_signature' => $validated['razorpay_signature'],
                    'verification_payload' => json_encode($validated),
                    'verified_at' => now(),
                    'updated_at' => now(),
                ]);

            return [
                'success' => true,
                'receipt_number' => $receiptNumber,
                'status' => $isFullyPaid ? 'paid' : 'partial',
            ];
        });

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['code']);
        }

        $adminUserIds = DB::table('user_roles')->where('role', 'admin')->pluck('user_id')->map(fn ($v) => (int) $v)->all();
        $this->notifyUsers(
            $adminUserIds,
            'Fee payment received',
            'Razorpay payment received for fee #'.$id.' (receipt '.$result['receipt_number'].')',
            'fee',
            '/admin/fees'
        );

        $this->notifyUsers(
            [(int) $request->user()->id],
            'Payment successful',
            'Your fee payment was successful. Receipt: '.$result['receipt_number'],
            'fee',
            '/parent/fees'
        );

        return response()->json($result);
    }

    public function payFee(Request $request, int $id): JsonResponse
    {
        $settings = $this->paymentGatewaySettings();
        if ($settings['configured']) {
            return response()->json([
                'message' => 'Direct pay is disabled when Razorpay is configured. Use payment order flow.',
            ], 422);
        }

        if (! Schema::hasTable('fees')) {
            return response()->json(['message' => 'fees table not found'], 422);
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
        ]);

        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student) {
            return response()->json(['message' => 'Linked student not found'], 404);
        }

        $fee = DB::table('fees')->where('id', $id)->where('student_id', $student->student_id)->first();
        if (! $fee) {
            return response()->json(['message' => 'Fee not found'], 404);
        }

        $netAmount = (float) $fee->amount - (float) ($fee->discount ?? 0);
        $alreadyPaid = (float) ($fee->paid_amount ?? 0);
        $remaining = max(0, $netAmount - $alreadyPaid);
        $payAmount = (float) $validated['amount'];
        if ($payAmount > $remaining) {
            return response()->json(['message' => 'Amount exceeds remaining balance'], 422);
        }

        $newPaidAmount = $alreadyPaid + $payAmount;
        $isFullyPaid = $newPaidAmount >= $netAmount;
        $receiptNumber = 'RCP-'.now()->format('Ymd').'-'.str_pad((string) random_int(1, 99999), 5, '0', STR_PAD_LEFT);

        DB::table('fees')->where('id', $id)->update([
            'paid_amount' => $newPaidAmount,
            'payment_status' => $isFullyPaid ? 'paid' : 'partial',
            'paid_at' => now(),
            'receipt_number' => $receiptNumber,
            'updated_at' => now(),
        ]);

        if (Schema::hasTable('fee_payments')) {
            DB::table('fee_payments')->insert([
                'fee_id' => $fee->id,
                'student_id' => $fee->student_id,
                'amount' => $payAmount,
                'payment_method' => 'manual',
                'receipt_number' => $receiptNumber,
                'paid_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $adminUserIds = DB::table('user_roles')->where('role', 'admin')->pluck('user_id')->map(fn ($v) => (int) $v)->all();
        $this->notifyUsers(
            $adminUserIds,
            'Fee payment received',
            'Manual payment recorded for fee #'.$id.' (receipt '.$receiptNumber.')',
            'fee',
            '/admin/fees'
        );

        $this->notifyUsers(
            [(int) $request->user()->id],
            'Payment successful',
            'Your fee payment was successful. Receipt: '.$receiptNumber,
            'fee',
            '/parent/fees'
        );

        return response()->json([
            'success' => true,
            'receipt_number' => $receiptNumber,
            'status' => $isFullyPaid ? 'paid' : 'partial',
        ]);
    }

    private function paymentGatewaySettings(): array
    {
        if (! Schema::hasTable('app_settings')) {
            return [
                'configured' => false,
                'key_id' => '',
                'key_secret' => '',
            ];
        }

        $rows = DB::table('app_settings')
            ->whereIn('setting_key', ['razorpay_key_id', 'razorpay_key_secret'])
            ->select('setting_key', 'setting_value')
            ->get();

        $keyId = $this->normalizeSettingValue($rows->firstWhere('setting_key', 'razorpay_key_id')->setting_value ?? '');
        $keySecret = $this->normalizeSettingValue($rows->firstWhere('setting_key', 'razorpay_key_secret')->setting_value ?? '');

        return [
            'configured' => $keyId !== '' && $keySecret !== '',
            'key_id' => $keyId,
            'key_secret' => $keySecret,
        ];
    }

    private function normalizeSettingValue(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (is_string($decoded)) {
                return $decoded;
            }

            return trim($value, '"');
        }

        return (string) $value;
    }

    public function complaints(Request $request): JsonResponse
    {
        if (! Schema::hasTable('complaints')) {
            return response()->json([]);
        }

        $rows = DB::table('complaints')
            ->where('submitted_by', $request->user()->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($row) {
                $visibleTo = $this->decodeVisibleTo($row->visible_to ?? null);

                return [
                    'id' => (string) $row->id,
                    'subject' => $row->subject,
                    'description' => $row->description,
                    'status' => $row->status,
                    'response' => $row->response,
                    'created_at' => $row->created_at,
                    'visible_to' => is_array($visibleTo) && ! empty($visibleTo) ? $visibleTo : ['admin'],
                ];
            });

        return response()->json($rows);
    }

    public function createComplaint(Request $request): JsonResponse
    {
        if (! Schema::hasTable('complaints')) {
            return response()->json(['message' => 'complaints table not found'], 422);
        }

        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'visible_to' => ['required', 'array', 'min:1'],
            'visible_to.*' => ['string', 'in:admin,teacher'],
        ]);

        $student = $this->resolveParentStudent($request->user()->id);

        $visibleTo = array_values(array_unique($validated['visible_to']));

        $id = DB::table('complaints')->insertGetId([
            'subject' => $validated['subject'],
            'description' => $validated['description'],
            'submitted_by' => $request->user()->id,
            'visible_to' => json_encode($visibleTo),
            'status' => 'open',
            'response' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $adminUserIds = DB::table('user_roles')->where('role', 'admin')->pluck('user_id')->map(fn ($v) => (int) $v)->all();

        $teacherUserIds = [];
        if ($student && in_array('teacher', $visibleTo, true) && Schema::hasTable('classes') && Schema::hasTable('teachers')) {
            $teacherUserIds = DB::table('classes')
                ->leftJoin('teachers', 'teachers.id', '=', 'classes.class_teacher_id')
                ->where('classes.id', $student->class_id)
                ->whereNotNull('teachers.user_id')
                ->pluck('teachers.user_id')
                ->map(fn ($v) => (int) $v)
                ->all();
        }

        $targets = array_values(array_unique(array_merge($adminUserIds, $teacherUserIds)));
        $this->notifyUsers(
            $targets,
            'New complaint received',
            'Complaint: '.$validated['subject'],
            'announcement',
            in_array('teacher', $visibleTo, true) ? '/teacher/reports' : '/admin/complaints'
        );

        return response()->json(['id' => $id], 201);
    }

    private function applyClassPeriodOverrides($rows, int $classId)
    {
        if ($classId <= 0 || ! Schema::hasTable('periods') || ! Schema::hasColumn('periods', 'class_id')) {
            return $rows;
        }

        $periodMap = DB::table('periods')
            ->where('class_id', $classId)
            ->orderBy('start_time')
            ->get()
            ->keyBy(fn ($period) => (string) $period->period_number);

        if ($periodMap->isEmpty()) {
            return $rows;
        }

        return $rows->map(function ($row) use ($periodMap) {
            $period = $periodMap->get((string) $row['period_number']);

            if (! $period) {
                return $row;
            }

            $row['period_label'] = $period->label;
            $row['period_type'] = $period->type;
            $row['start_time'] = $period->start_time;
            $row['end_time'] = $period->end_time;

            return $row;
        });
    }

    private function decodeVisibleTo(mixed $value): array
    {
        if (is_array($value)) {
            return ! empty($value) ? $value : ['admin'];
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (is_array($decoded) && ! empty($decoded)) {
                return $decoded;
            }

            return $value !== '' ? [$value] : ['admin'];
        }

        return ['admin'];
    }

    public function leaveRequests(Request $request): JsonResponse
    {
        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student) {
            return response()->json(['studentId' => null, 'childName' => '', 'leaves' => []]);
        }

        $rows = DB::table('leave_requests')
            ->where('student_id', $student->student_id)
            ->where('request_type', 'student')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'from_date' => $row->from_date,
                'to_date' => $row->to_date,
                'reason' => $row->reason,
                'status' => $row->status,
                'created_at' => $row->created_at,
                'attachment_url' => $this->normalizeLegacyAttachmentUrl($row->attachment_url),
            ]);

        return response()->json([
            'studentId' => (string) $student->student_id,
            'childName' => $student->full_name ?? '',
            'leaves' => $rows,
        ]);
    }

    public function createLeaveRequest(Request $request): JsonResponse
    {
        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student) {
            return response()->json(['message' => 'Linked student not found'], 404);
        }

        $validated = $request->validate([
            'from_date' => ['required', 'date'],
            'to_date' => ['required', 'date', 'after_or_equal:from_date'],
            'reason' => ['required', 'string'],
            'attachment' => ['nullable', 'file', 'max:5120'],
        ]);

        $attachmentUrl = null;
        if ($request->hasFile('attachment')) {
            $path = $request->file('attachment')->store('leave-docs', $this->uploadDisk());
            $attachmentUrl = $this->buildPublicUploadUrl($path);
        }

        $id = DB::table('leave_requests')->insertGetId([
            'student_id' => $student->student_id,
            'teacher_id' => null,
            'request_type' => 'student',
            'from_date' => $validated['from_date'],
            'to_date' => $validated['to_date'],
            'reason' => $validated['reason'],
            'status' => 'pending',
            'approved_by' => null,
            'attachment_url' => $attachmentUrl,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $adminUserIds = DB::table('user_roles')->where('role', 'admin')->pluck('user_id')->map(fn ($v) => (int) $v)->all();
        $this->notifyUsers(
            $adminUserIds,
            'New parent leave request',
            'Leave requested for '.$student->full_name.' from '.$validated['from_date'].' to '.$validated['to_date'],
            'leave',
            '/admin/leave'
        );

        return response()->json(['id' => $id], 201);
    }

    public function certificateRequests(Request $request): JsonResponse
    {
        if (! Schema::hasTable('certificate_requests')) {
            return response()->json(['studentId' => null, 'childName' => '', 'requests' => []]);
        }

        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student) {
            return response()->json(['studentId' => null, 'childName' => '', 'requests' => []]);
        }

        $hasDescription = Schema::hasColumn('certificate_requests', 'description');
        $hasAdminRemarks = Schema::hasColumn('certificate_requests', 'admin_remarks');

        $rows = DB::table('certificate_requests')
            ->where('student_id', $student->student_id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'certificate_type' => $row->certificate_type,
                'status' => $row->status,
                'created_at' => $row->created_at,
                'attachment_url' => $this->normalizeLegacyAttachmentUrl($row->attachment_url),
                'description' => $hasDescription ? ($row->description ?? null) : null,
                'admin_remarks' => $hasAdminRemarks ? ($row->admin_remarks ?? null) : null,
            ]);

        return response()->json([
            'studentId' => (string) $student->student_id,
            'childName' => $student->full_name ?? '',
            'requests' => $rows,
        ]);
    }

    public function createCertificateRequest(Request $request): JsonResponse
    {
        if (! Schema::hasTable('certificate_requests')) {
            return response()->json(['message' => 'certificate_requests table not found'], 422);
        }

        $student = $this->resolveParentStudent($request->user()->id);
        if (! $student) {
            return response()->json(['message' => 'Linked student not found'], 404);
        }

        $validated = $request->validate([
            'certificate_type' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'attachment' => ['nullable', 'file', 'max:5120'],
        ]);

        $attachmentUrl = null;
        if ($request->hasFile('attachment')) {
            $path = $request->file('attachment')->store('certificate-docs', $this->uploadDisk());
            $attachmentUrl = $this->buildPublicUploadUrl($path);
        }

        $insert = [
            'student_id' => $student->student_id,
            'certificate_type' => $validated['certificate_type'],
            'requested_by' => $request->user()->id,
            'status' => 'pending',
            'approved_by' => null,
            'attachment_url' => $attachmentUrl,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('certificate_requests', 'description')) {
            $insert['description'] = $validated['description'] ?? null;
        }

        $id = DB::table('certificate_requests')->insertGetId($insert);

        $adminUserIds = DB::table('user_roles')->where('role', 'admin')->pluck('user_id')->map(fn ($v) => (int) $v)->all();
        $this->notifyUsers(
            $adminUserIds,
            'New certificate request',
            $validated['certificate_type'].' request submitted',
            'certificate',
            '/admin/certificates'
        );

        return response()->json(['id' => $id], 201);
    }

    private function notifyUsers(array $userIds, string $title, string $message, string $type = 'general', ?string $link = null): void
    {
        if (empty($userIds)) {
            return;
        }
        app(NotificationService::class)->notifyUsers($userIds, $title, $message, [
            'type' => $type,
            'link' => $link,
            'priority' => 'high',
            'channel' => 'both',
        ]);
    }

    private function normalizeLegacyAttachmentUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $path = (string) parse_url($url, PHP_URL_PATH);
        if ($path === '') {
            return $url;
        }

        if (str_starts_with($path, '/backend/public/uploads/')) {
            return $this->buildPublicUploadUrl(substr($path, strlen('/backend/public/uploads/')));
        }

        if (str_starts_with($path, '/uploads/')) {
            return $this->buildPublicUploadUrl(substr($path, strlen('/uploads/')));
        }

        if (str_starts_with($path, '/backend/public/storage/')) {
            return $this->buildLegacyStorageUrl(substr($path, strlen('/backend/public/storage/')));
        }

        if (str_starts_with($path, '/public/storage/')) {
            return $this->buildLegacyStorageUrl(substr($path, strlen('/public/storage/')));
        }

        if (str_starts_with($path, '/storage/')) {
            return $this->buildLegacyStorageUrl(substr($path, strlen('/storage/')));
        }

        return $url;
    }

    private function buildPublicUploadUrl(string $path): string
    {
        return $this->buildUploadUrl($path);
    }

}
