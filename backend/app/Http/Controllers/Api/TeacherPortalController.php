<?php

namespace App\Http\Controllers\Api;

use App\Support\HandlesUploadStorage;
use App\Http\Controllers\Controller;
use App\Models\ParentAccount;
use App\Models\Profile;
use App\Models\User;
use App\Models\UserRole;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class TeacherPortalController extends Controller
{
    use HandlesUploadStorage;

    public function attendanceData(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'class_id' => ['nullable'],
            'date' => ['nullable', 'date'],
        ]);

        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher) {
            return response()->json(['teacher_id' => null, 'classes' => [], 'students' => [], 'attendance' => []]);
        }

        $classIds = collect();
        if (Schema::hasTable('teacher_classes')) {
            $classIds = $classIds->merge(DB::table('teacher_classes')->where('teacher_id', $teacher->id)->pluck('class_id'));
        }
        $classIds = $classIds->merge(DB::table('classes')->where('class_teacher_id', $teacher->id)->pluck('id'))->unique()->values();

        $classes = DB::table('classes')
            ->whereIn('id', $classIds->all())
            ->select('id', 'name', 'section')
            ->orderBy('name')
            ->get()
            ->map(fn ($r) => ['id' => (string) $r->id, 'name' => $r->name, 'section' => $r->section]);

        $selectedClassId = $validated['class_id'] ?? ($classes->first()['id'] ?? null);
        if (! $selectedClassId) {
            return response()->json(['teacher_id' => (string) $teacher->id, 'classes' => $classes, 'students' => [], 'attendance' => []]);
        }

        $students = DB::table('students')
            ->select('id', 'full_name', 'admission_number', 'photo_url')
            ->where('class_id', $selectedClassId)
            ->orderBy('full_name')
            ->get()
            ->map(fn ($r) => [
                'id' => (string) $r->id,
                'full_name' => $r->full_name,
                'admission_number' => $r->admission_number,
                'photo_url' => $r->photo_url,
            ]);

        $date = $validated['date'] ?? now()->toDateString();
        $studentIds = $students->pluck('id')->all();
        $attendance = empty($studentIds)
            ? collect()
            : DB::table('attendance')
                ->select('student_id', 'status')
                ->whereIn('student_id', $studentIds)
                ->whereDate('date', $date)
                ->get()
                ->map(fn ($r) => ['student_id' => (string) $r->student_id, 'status' => $r->status]);

        return response()->json([
            'teacher_id' => (string) $teacher->id,
            'classes' => $classes,
            'students' => $students,
            'attendance' => $attendance,
        ]);
    }

    public function saveAttendance(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'date'],
            'records' => ['required', 'array'],
            'records.*.student_id' => ['required'],
            'records.*.status' => ['required', 'in:present,absent,late'],
        ]);

        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher) {
            return response()->json(['message' => 'Teacher not found'], 404);
        }

        $studentIds = collect($validated['records'])->pluck('student_id')->all();
        DB::table('attendance')
            ->whereIn('student_id', $studentIds)
            ->whereDate('date', $validated['date'])
            ->delete();

        $studentClassMap = DB::table('students')
            ->leftJoin('classes', 'classes.id', '=', 'students.class_id')
            ->whereIn('students.id', $studentIds)
            ->select(
                'students.id',
                'students.class_id',
                'classes.name as class_name',
                'classes.section as class_section'
            )
            ->get()
            ->keyBy('id');

        $rows = collect($validated['records'])->map(fn ($r) => [
            'student_id' => $r['student_id'],
            'class_id_snapshot' => $studentClassMap[$r['student_id']]->class_id ?? null,
            'class_name_snapshot' => $studentClassMap[$r['student_id']]->class_name ?? null,
            'class_section_snapshot' => $studentClassMap[$r['student_id']]->class_section ?? null,
            'date' => $validated['date'],
            'status' => $r['status'],
            'marked_by' => $teacher->id,
            'created_at' => now(),
            'updated_at' => now(),
        ])->all();
        DB::table('attendance')->insert($rows);

        return response()->json(['message' => 'Saved']);
    }

    public function studentsData(Request $request): JsonResponse
    {
        $validated = $request->validate(['class_id' => ['nullable']]);

        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher) {
            return response()->json(['classes' => [], 'students' => []]);
        }

        $classIds = collect();
        if (Schema::hasTable('teacher_classes')) {
            $classIds = $classIds->merge(DB::table('teacher_classes')->where('teacher_id', $teacher->id)->pluck('class_id'));
        }
        $classIds = $classIds->merge(DB::table('classes')->where('class_teacher_id', $teacher->id)->pluck('id'))->unique()->values();

        $classes = DB::table('classes')
            ->whereIn('id', $classIds->all())
            ->select('id', 'name', 'section')
            ->orderBy('name')
            ->get()
            ->map(fn ($r) => ['id' => (string) $r->id, 'name' => $r->name, 'section' => $r->section]);

        $selectedClass = $validated['class_id'] ?? ($classes->first()['id'] ?? null);
        $students = collect();
        if ($selectedClass) {
            $students = DB::table('students')
                ->leftJoin('classes', 'classes.id', '=', 'students.class_id')
                ->where('students.class_id', $selectedClass)
                ->select(
                    'students.*',
                    'classes.name as class_name',
                    'classes.section as class_section'
                )
                ->orderBy('students.full_name')
                ->get()
                ->map(fn ($r) => [
                    'id' => (string) $r->id,
                    'full_name' => $r->full_name,
                    'admission_number' => $r->admission_number,
                    'photo_url' => $r->photo_url,
                    'date_of_birth' => $r->date_of_birth,
                    'address' => $r->address,
                    'status' => $r->status,
                    'blood_group' => $r->blood_group,
                    'emergency_contact' => $r->emergency_contact,
                    'emergency_contact_name' => $r->emergency_contact_name,
                    'parent_name' => $r->parent_name,
                    'parent_phone' => $r->parent_phone,
                    'class_id' => $r->class_id ? (string) $r->class_id : null,
                    'classes' => $r->class_name ? ['name' => $r->class_name, 'section' => $r->class_section] : null,
                ]);
        }

        return response()->json([
            'classes' => $classes,
            'students' => $students,
        ]);
    }

    public function createStudent(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'class_id' => ['required'],
            'date_of_birth' => ['nullable', 'date'],
            'address' => ['nullable', 'string'],
            'blood_group' => ['nullable', 'string', 'max:20'],
            'parent_name' => ['nullable', 'string', 'max:255'],
            'parent_phone' => ['nullable', 'string', 'max:50'],
            'emergency_contact' => ['nullable', 'string', 'max:50'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:4'],
            'email' => ['nullable', 'email', 'max:255'],
            'photo' => ['nullable', 'image', 'max:5120'],
        ]);

        $class = DB::table('classes')->where('id', $validated['class_id'])->first();
        if (! $class) {
            return response()->json(['message' => 'Class not found'], 422);
        }

        $studentId = $this->buildStudentId($validated['full_name'], $class->name, $class->section);
        $photoUrl = null;
        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('students', $this->uploadDisk());
            $photoUrl = $this->buildPublicUploadUrl($path);
        }

        DB::table('students')->insert([
            'admission_number' => $studentId,
            'full_name' => $validated['full_name'],
            'class_id' => $validated['class_id'],
            'date_of_birth' => $validated['date_of_birth'] ?? null,
            'blood_group' => $validated['blood_group'] ?? null,
            'photo_url' => $photoUrl,
            'parent_name' => $validated['parent_name'] ?? null,
            'parent_phone' => $validated['parent_phone'] ?? null,
            'address' => $validated['address'] ?? null,
            'emergency_contact' => $validated['emergency_contact'] ?? null,
            'emergency_contact_name' => $validated['emergency_contact_name'] ?? null,
            'login_id' => $studentId,
            'password_hash' => Hash::make($validated['password']),
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $student = DB::table('students')->where('admission_number', $studentId)->first();

        $parentName = ($validated['parent_name'] ?? null) ?: $validated['full_name'].' Parent';
        $parentEmail = ($validated['email'] ?? null) ?: strtolower($studentId).'@parent.local';

        $existingUser = User::where('email', $parentEmail)->first();
        if ($existingUser) {
            $existingRole = DB::table('user_roles')->where('user_id', $existingUser->id)->value('role');
            if ($existingRole && $existingRole !== 'parent') {
                return response()->json(['message' => 'Parent email belongs to a non-parent account'], 422);
            }
        }

        $parentUser = $existingUser ?: User::create([
            'name' => $parentName,
            'email' => $parentEmail,
            'password' => Hash::make($validated['password']),
        ]);

        if (! $existingUser) {
            UserRole::updateOrCreate(['user_id' => $parentUser->id], ['role' => 'parent']);
        }

        Profile::updateOrCreate(
            ['user_id' => $parentUser->id],
            [
                'full_name' => $parentName,
                'email' => $parentEmail,
                'phone' => $validated['parent_phone'] ?? null,
            ]
        );

        $parent = ParentAccount::firstOrCreate(
            ['user_id' => $parentUser->id],
            ['phone' => $validated['parent_phone'] ?? null]
        );

        DB::table('student_parents')->updateOrInsert(
            [
                'student_id' => $student->id,
                'parent_id' => $parent->id,
            ],
            [
                'relationship' => 'parent',
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        return response()->json(['student_id' => $studentId, 'parent_email' => $parentEmail], 201);
    }

    public function updateStudent(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'date_of_birth' => ['nullable', 'date'],
            'address' => ['nullable', 'string'],
            'blood_group' => ['nullable', 'string', 'max:20'],
            'parent_name' => ['nullable', 'string', 'max:255'],
            'parent_phone' => ['nullable', 'string', 'max:50'],
            'emergency_contact' => ['nullable', 'string', 'max:50'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:30'],
            'password' => ['nullable', 'string', 'min:4'],
        ]);

        $student = DB::table('students')->where('id', $id)->first();
        if (! $student) {
            return response()->json(['message' => 'Student not found'], 404);
        }

        DB::table('students')->where('id', $id)->update([
            'full_name' => $validated['full_name'],
            'date_of_birth' => $validated['date_of_birth'] ?? null,
            'address' => $validated['address'] ?? null,
            'blood_group' => $validated['blood_group'] ?? null,
            'parent_name' => $validated['parent_name'] ?? null,
            'parent_phone' => $validated['parent_phone'] ?? null,
            'emergency_contact' => $validated['emergency_contact'] ?? null,
            'emergency_contact_name' => $validated['emergency_contact_name'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'updated_at' => now(),
        ]);

        if (! empty($validated['password'])) {
            $hashed = Hash::make($validated['password']);

            // Keep student local password hash aligned
            DB::table('students')->where('id', $id)->update([
                'password_hash' => $hashed,
                'updated_at' => now(),
            ]);

            // Update linked parent user password used by Student/Parent login
            $parentUserId = null;
            if (Schema::hasTable('student_parents') && Schema::hasTable('parents')) {
                $parentUserId = DB::table('student_parents')
                    ->join('parents', 'parents.id', '=', 'student_parents.parent_id')
                    ->where('student_parents.student_id', $id)
                    ->value('parents.user_id');
            }

            if (! $parentUserId && ! empty($student->admission_number)) {
                $fallbackEmail = strtolower((string) $student->admission_number).'@parent.local';
                $parentUserId = DB::table('users')->where('email', $fallbackEmail)->value('id');
            }

            if ($parentUserId) {
                DB::table('users')->where('id', $parentUserId)->update([
                    'password' => $hashed,
                    'updated_at' => now(),
                ]);
            }
        }

        return response()->json(['message' => 'Updated']);
    }

    private function buildStudentId(string $fullName, string $className, string $section): string
    {
        $namePart = strtoupper(preg_replace('/[^A-Z]/', '', explode(' ', strtoupper($fullName))[0] ?? 'NAME'));
        $classPart = strtoupper(preg_replace('/[^A-Z0-9]/', '', strtoupper($className)));
        $sectionPart = strtoupper(preg_replace('/[^A-Z]/', '', strtoupper($section)));

        // Only add section if it exists
        $base = ($namePart ?: 'NAME').'-'.($classPart ?: 'CLASS');
        if ($sectionPart) {
            $base .= '-'.$sectionPart;
        }
        
        $candidate = $base;
        $counter = 1;
        while (DB::table('students')->where('admission_number', $candidate)->exists()) {
            $counter++;
            $candidate = $base.$counter;
        }

        return $candidate;
    }

    public function classes(Request $request): JsonResponse
    {
        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher) {
            return response()->json([]);
        }

        $classIds = collect();
        if (Schema::hasTable('teacher_classes')) {
            $classIds = $classIds->merge(
                DB::table('teacher_classes')->where('teacher_id', $teacher->id)->pluck('class_id')
            );
        }

        $classIds = $classIds->merge(
            DB::table('classes')->where('class_teacher_id', $teacher->id)->pluck('id')
        )->unique()->values();

        if ($classIds->isEmpty()) {
            return response()->json([]);
        }

        $classes = DB::table('classes')
            ->leftJoin('students', 'students.class_id', '=', 'classes.id')
            ->whereIn('classes.id', $classIds->all())
            ->select('classes.id', 'classes.name', 'classes.section', 'classes.academic_year', DB::raw('COUNT(students.id) as studentCount'))
            ->groupBy('classes.id', 'classes.name', 'classes.section', 'classes.academic_year')
            ->orderBy('classes.name')
            ->get();

        return response()->json($classes);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher) {
            return response()->json([
                'profileName' => 'Teacher',
                'stats' => ['myClasses' => 0, 'totalStudents' => 0, 'pendingHomework' => 0, 'pendingAttendance' => true],
                'todaySchedule' => [],
                'upcomingExams' => [],
                'compExams' => [],
            ]);
        }

        $profileName = DB::table('profiles')->where('user_id', $request->user()->id)->value('full_name') ?? 'Teacher';
        $profileName = explode(' ', trim($profileName))[0] ?: 'Teacher';

        $classIds = collect();
        if (Schema::hasTable('teacher_classes')) {
            $classIds = $classIds->merge(DB::table('teacher_classes')->where('teacher_id', $teacher->id)->pluck('class_id'));
        }
        $classIds = $classIds->merge(DB::table('classes')->where('class_teacher_id', $teacher->id)->pluck('id'))->unique()->values();

        $todayDate = now()->toDateString();
        $totalStudents = $classIds->isNotEmpty()
            ? (int) DB::table('students')->whereIn('class_id', $classIds->all())->count()
            : 0;

        $attendanceCount = Schema::hasTable('attendance')
            ? DB::table('attendance')->where('marked_by', $teacher->id)->whereDate('date', $todayDate)->count()
            : 0;

        $pendingHomework = 0;
        if (Schema::hasTable('homework') && $classIds->isNotEmpty()) {
            $pendingHomework = (int) DB::table('homework')
                ->whereIn('class_id', $classIds->all())
                ->whereDate('due_date', '>=', $todayDate)
                ->count();
        }

        $todaySchedule = [];
        if (Schema::hasTable('timetable')) {
            $today = now()->format('l');
            $todaySchedule = DB::table('timetable')
                ->leftJoin('classes', 'classes.id', '=', 'timetable.class_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'timetable.subject_id')
                ->leftJoin('periods', 'periods.id', '=', 'timetable.period_id')
                ->where('timetable.teacher_id', $teacher->id)
                ->where('timetable.day_of_week', $today)
                ->where('timetable.is_published', true)
                ->select(
                    'timetable.id',
                    DB::raw('COALESCE(periods.start_time, timetable.start_time) as start_time'),
                    DB::raw('COALESCE(periods.end_time, timetable.end_time) as end_time'),
                    'timetable.day_of_week',
                    'classes.name as class_name',
                    'classes.section as class_section',
                    'subjects.name as subject_name',
                    'periods.label as period_label'
                )
                ->orderBy('start_time')
                ->get()
                ->map(fn ($row) => [
                    'id' => $row->id,
                    'start_time' => $row->start_time,
                    'end_time' => $row->end_time,
                    'day_of_week' => $row->day_of_week,
                    'period_label' => $row->period_label,
                    'classes' => $row->class_name ? ['name' => $row->class_name, 'section' => $row->class_section] : null,
                    'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                ]);
        }

        $upcomingExams = [];
        if (Schema::hasTable('exams')) {
            $upcomingExams = DB::table('exams')
                ->leftJoin('classes', 'classes.id', '=', 'exams.class_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'exams.subject_id')
                ->whereDate('exams.exam_date', '>=', $todayDate)
                ->select(
                    'exams.id',
                    'exams.name',
                    'exams.exam_date',
                    'exams.exam_time',
                    'exams.max_marks',
                    'classes.name as class_name',
                    'classes.section as class_section',
                    'subjects.name as subject_name'
                )
                ->orderBy('exams.exam_date')
                ->orderBy('exams.exam_time')
                ->limit(5)
                ->get()
                ->map(fn ($row) => [
                    'id' => $row->id,
                    'name' => $row->name,
                    'exam_date' => $row->exam_date,
                    'exam_time' => $row->exam_time,
                    'max_marks' => $row->max_marks,
                    'classes' => $row->class_name ? ['name' => $row->class_name, 'section' => $row->class_section] : null,
                    'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                ]);
        }

        $compExams = [];
        if (Schema::hasTable('weekly_exams')) {
            $compExams = DB::table('weekly_exams')
                ->leftJoin('classes', 'classes.id', '=', 'weekly_exams.class_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'weekly_exams.subject_id')
                ->where('weekly_exams.syllabus_type', 'competitive')
                ->whereDate('weekly_exams.exam_date', '>=', $todayDate)
                ->select(
                    'weekly_exams.id',
                    'weekly_exams.exam_title',
                    'weekly_exams.exam_date',
                    'weekly_exams.exam_time',
                    'weekly_exams.total_marks',
                    'weekly_exams.exam_type_label',
                    'classes.name as class_name',
                    'classes.section as class_section',
                    'subjects.name as subject_name'
                )
                ->orderBy('weekly_exams.exam_date')
                ->limit(1)
                ->get()
                ->map(fn ($row) => [
                    'id' => $row->id,
                    'exam_title' => $row->exam_title,
                    'exam_date' => $row->exam_date,
                    'exam_time' => $row->exam_time,
                    'total_marks' => $row->total_marks,
                    'exam_type_label' => $row->exam_type_label,
                    'classes' => $row->class_name ? ['name' => $row->class_name, 'section' => $row->class_section] : null,
                    'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                ]);
        }

        return response()->json([
            'profileName' => $profileName,
            'stats' => [
                'myClasses' => $classIds->count(),
                'totalStudents' => $totalStudents,
                'pendingHomework' => $pendingHomework,
                'pendingAttendance' => $attendanceCount === 0,
            ],
            'todaySchedule' => $todaySchedule,
            'upcomingExams' => $upcomingExams,
            'compExams' => $compExams,
        ]);
    }

    public function timetableData(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'class_id' => ['nullable'],
        ]);

        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher || ! Schema::hasTable('timetable')) {
            return response()->json([
                'teacherId' => null,
                'teacherName' => 'Teacher',
                'classes' => [],
                'mySchedule' => [],
                'classTimetable' => [],
            ]);
        }

        $teacherName = DB::table('profiles')->where('user_id', $request->user()->id)->value('full_name') ?: 'Teacher';

        $classIds = collect();
        if (Schema::hasTable('teacher_classes')) {
            $classIds = $classIds->merge(DB::table('teacher_classes')->where('teacher_id', $teacher->id)->pluck('class_id'));
        }
        $classIds = $classIds->merge(DB::table('classes')->where('class_teacher_id', $teacher->id)->pluck('id'))->unique()->values();

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

        $mySchedule = DB::table('timetable')
            ->leftJoin('subjects', 'subjects.id', '=', 'timetable.subject_id')
            ->leftJoin('classes', 'classes.id', '=', 'timetable.class_id')
            ->leftJoin('periods', 'periods.id', '=', 'timetable.period_id')
            ->where('timetable.teacher_id', $teacher->id)
            ->where('timetable.is_published', true)
            ->select(
                'timetable.id',
                'timetable.day_of_week',
                'timetable.period_number',
                DB::raw('COALESCE(periods.start_time, timetable.start_time) as start_time'),
                DB::raw('COALESCE(periods.end_time, timetable.end_time) as end_time'),
                'subjects.name as subject_name',
                'classes.name as class_name',
                'classes.section as class_section',
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
                'className' => $row->class_name ? $row->class_name.'-'.$row->class_section : null,
            ]);

        $selectedClassId = $validated['class_id'] ?? ($classes->first()['id'] ?? null);
        $classTimetable = collect();
        if ($selectedClassId) {
            $classTimetable = DB::table('timetable')
                ->leftJoin('subjects', 'subjects.id', '=', 'timetable.subject_id')
                ->leftJoin('teachers', 'teachers.id', '=', 'timetable.teacher_id')
                ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
                ->leftJoin('periods', 'periods.id', '=', 'timetable.period_id')
                ->where('timetable.class_id', $selectedClassId)
                ->where('timetable.is_published', true)
                ->select(
                    'timetable.id',
                    'timetable.day_of_week',
                    'timetable.period_number',
                    DB::raw('COALESCE(periods.start_time, timetable.start_time) as start_time'),
                    DB::raw('COALESCE(periods.end_time, timetable.end_time) as end_time'),
                    'timetable.teacher_id',
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
                    'teacher_id' => $row->teacher_id ? (string) $row->teacher_id : null,
                    'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                    'teacherName' => $row->teacher_name,
                ]);

            if ($classTimetable->isEmpty()) {
                $classTimetable = DB::table('timetable')
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
                        'timetable.teacher_id',
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
                        'teacher_id' => $row->teacher_id ? (string) $row->teacher_id : null,
                        'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                        'teacherName' => $row->teacher_name,
                    ]);

                $classTimetable = $this->applyClassPeriodOverrides($classTimetable, (int) $selectedClassId);
            }
        }

        return response()->json([
            'teacherId' => (string) $teacher->id,
            'teacherName' => $teacherName,
            'classes' => $classes,
            'selectedClass' => $selectedClassId ? (string) $selectedClassId : null,
            'mySchedule' => $mySchedule,
            'classTimetable' => $classTimetable,
        ]);
    }

    public function syllabusData(Request $request): JsonResponse
    {
        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher || ! Schema::hasTable('syllabus')) {
            return response()->json([
                'teacherName' => 'Teacher',
                'mappings' => [],
                'syllabus' => [],
                'completedByNames' => [],
            ]);
        }

        $teacherName = DB::table('profiles')->where('user_id', $request->user()->id)->value('full_name') ?: 'Teacher';

        $mappings = Schema::hasTable('teacher_syllabus_map')
            ? DB::table('teacher_syllabus_map')
                ->where('teacher_id', $teacher->id)
                ->select('id', 'syllabus_id', 'teacher_id', 'role_type')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'syllabus_id' => (string) $row->syllabus_id,
                    'teacher_id' => (string) $row->teacher_id,
                    'role_type' => $row->role_type,
                ])
            : collect();

        $syllabusRows = DB::table('syllabus')
            ->leftJoin('classes', 'classes.id', '=', 'syllabus.class_id')
            ->leftJoin('subjects', 'subjects.id', '=', 'syllabus.subject_id')
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
                'syllabus.class_id',
                'syllabus.subject_id',
                'classes.name as class_name',
                'classes.section as class_section',
                'subjects.name as subject_name'
            )
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
            'class_id' => (string) $row->class_id,
            'subject_id' => (string) $row->subject_id,
            'classes' => $row->class_name ? ['name' => $row->class_name, 'section' => $row->class_section] : null,
            'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
        ]);

        $completedByNames = [];
        $completedByIds = $syllabusRows->pluck('completed_by')->filter()->unique()->values()->all();
        if (! empty($completedByIds)) {
            $profiles = DB::table('profiles')->whereIn('user_id', $completedByIds)->select('user_id', 'full_name')->get();
            foreach ($profiles as $profile) {
                $completedByNames[(string) $profile->user_id] = $profile->full_name;
            }
        }

        return response()->json([
            'teacherName' => $teacherName,
            'mappings' => $mappings,
            'syllabus' => $syllabus,
            'completedByNames' => $completedByNames,
        ]);
    }

    public function markSyllabusCompleted(Request $request, int $id): JsonResponse
    {
        DB::table('syllabus')->where('id', $id)->update([
            'completed_at' => now(),
            'completed_by' => $request->user()->id,
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Marked as completed']);
    }

    public function homeworkData(Request $request): JsonResponse
    {
        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher) {
            return response()->json(['teacherId' => null, 'classes' => [], 'subjects' => [], 'homework' => []]);
        }

        $classIds = collect();
        if (Schema::hasTable('teacher_classes')) {
            $classIds = $classIds->merge(DB::table('teacher_classes')->where('teacher_id', $teacher->id)->pluck('class_id'));
        }
        $classIds = $classIds->merge(DB::table('classes')->where('class_teacher_id', $teacher->id)->pluck('id'))->unique()->values();

        $classes = DB::table('classes')
            ->whereIn('id', $classIds->all())
            ->select('id', 'name', 'section')
            ->orderBy('name')
            ->get()
            ->map(fn ($row) => ['id' => (string) $row->id, 'name' => $row->name, 'section' => $row->section]);

        $subjects = DB::table('subjects')
            ->select('id', 'name')
            ->orderBy('name')
            ->get()
            ->map(fn ($row) => ['id' => (string) $row->id, 'name' => $row->name]);

        $homework = collect();
        if ($classIds->isNotEmpty() && Schema::hasTable('homework')) {
            $homework = DB::table('homework')
                ->leftJoin('classes', 'classes.id', '=', 'homework.class_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'homework.subject_id')
                ->whereIn('homework.class_id', $classIds->all())
                ->select(
                    'homework.id',
                    'homework.title',
                    'homework.description',
                    'homework.due_date',
                    'homework.class_id',
                    'homework.subject_id',
                    'homework.created_at',
                    'classes.name as class_name',
                    'classes.section as class_section',
                    'subjects.name as subject_name'
                )
                ->orderByDesc('homework.due_date')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'title' => $row->title,
                    'description' => $row->description,
                    'due_date' => $row->due_date,
                    'class_id' => (string) $row->class_id,
                    'subject_id' => $row->subject_id ? (string) $row->subject_id : null,
                    'created_at' => $row->created_at,
                    'classes' => $row->class_name ? ['name' => $row->class_name, 'section' => $row->class_section] : null,
                    'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                ]);
        }

        return response()->json([
            'teacherId' => (string) $teacher->id,
            'classes' => $classes,
            'subjects' => $subjects,
            'homework' => $homework,
        ]);
    }

    public function createHomework(Request $request): JsonResponse
    {
        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher) {
            return response()->json(['message' => 'Teacher not found'], 404);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['required', 'date'],
            'class_id' => ['required'],
            'subject_id' => ['nullable'],
            'attachment' => ['nullable', 'file', 'max:5120'],
        ]);

        $attachmentUrl = null;
        if ($request->hasFile('attachment')) {
            $path = $request->file('attachment')->store('homework', $this->uploadDisk());
            $attachmentUrl = $this->buildPublicUploadUrl($path);
        }

        $id = DB::table('homework')->insertGetId([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'due_date' => $validated['due_date'],
            'class_id' => $validated['class_id'],
            'subject_id' => $validated['subject_id'] ?? null,
            'created_by' => $teacher->id,
            'attachment_url' => $attachmentUrl,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $parentUserIds = DB::table('students')
            ->join('student_parents', 'student_parents.student_id', '=', 'students.id')
            ->join('parents', 'parents.id', '=', 'student_parents.parent_id')
            ->where('students.class_id', $validated['class_id'])
            ->pluck('parents.user_id')
            ->all();

        app(NotificationService::class)->notifyUsers(
            $parentUserIds,
            'New homework assigned',
            $validated['title'].' is due on '.$validated['due_date'],
            [
                'type' => 'homework',
                'link' => '/parent/homework',
                'entity_type' => 'homework',
                'entity_id' => $id,
                'priority' => 'normal',
                'channel' => 'both',
            ]
        );

        return response()->json(['id' => $id], 201);
    }

    public function deleteHomework(Request $request, int $id): JsonResponse
    {
        DB::table('homework')->where('id', $id)->delete();

        return response()->json(['message' => 'Deleted']);
    }

    public function weeklyExamsData(Request $request): JsonResponse
    {
        $exams = Schema::hasTable('weekly_exams')
            ? DB::table('weekly_exams')
                ->leftJoin('classes', 'classes.id', '=', 'weekly_exams.class_id')
                ->leftJoin('subjects', 'subjects.id', '=', 'weekly_exams.subject_id')
                ->select(
                    'weekly_exams.*',
                    'classes.name as class_name',
                    'classes.section as class_section',
                    'subjects.name as subject_name'
                )
                ->orderByDesc('weekly_exams.exam_date')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'exam_title' => $row->exam_title,
                    'exam_date' => $row->exam_date,
                    'exam_time' => $row->exam_time,
                    'duration_minutes' => (int) $row->duration_minutes,
                    'total_marks' => (int) $row->total_marks,
                    'negative_marking' => (bool) $row->negative_marking,
                    'negative_marks_value' => (float) ($row->negative_marks_value ?? 0),
                    'status' => $row->status,
                    'syllabus_type' => $row->syllabus_type,
                    'week_number' => $row->week_number,
                    'class_id' => (string) $row->class_id,
                    'subject_id' => $row->subject_id ? (string) $row->subject_id : null,
                    'description' => $row->description,
                    'exam_type_label' => $row->exam_type_label,
                    'classes' => $row->class_name ? ['name' => $row->class_name, 'section' => $row->class_section] : null,
                    'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                ])
            : collect();

        $links = Schema::hasTable('weekly_exam_syllabus')
            ? DB::table('weekly_exam_syllabus')->select('exam_id', 'syllabus_id')->get()->map(fn ($row) => [
                'exam_id' => (string) $row->exam_id,
                'syllabus_id' => (string) $row->syllabus_id,
            ])
            : collect();

        $syllabus = Schema::hasTable('syllabus')
            ? DB::table('syllabus')
                ->leftJoin('subjects', 'subjects.id', '=', 'syllabus.subject_id')
                ->select('syllabus.id', 'syllabus.chapter_name', 'syllabus.topic_name', 'subjects.name as subject_name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'chapter_name' => $row->chapter_name,
                    'topic_name' => $row->topic_name,
                    'subjects' => $row->subject_name ? ['name' => $row->subject_name] : null,
                ])
            : collect();

        $papers = Schema::hasTable('question_papers')
            ? DB::table('question_papers')->select('id', 'exam_id', 'total_questions', 'total_marks')->get()->map(fn ($row) => [
                'id' => (string) $row->id,
                'exam_id' => (string) $row->exam_id,
                'total_questions' => (int) $row->total_questions,
                'total_marks' => (int) $row->total_marks,
            ])
            : collect();

        $questions = Schema::hasTable('questions')
            ? DB::table('questions')->orderBy('question_number')->get()->map(fn ($row) => [
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
                'marks' => (int) $row->marks,
            ])
            : collect();

        $results = Schema::hasTable('student_exam_results')
            ? DB::table('student_exam_results')
                ->leftJoin('students', 'students.id', '=', 'student_exam_results.student_id')
                ->select(
                    'student_exam_results.id',
                    'student_exam_results.student_id',
                    'student_exam_results.exam_id',
                    'student_exam_results.obtained_marks',
                    'student_exam_results.total_marks',
                    'student_exam_results.percentage',
                    'student_exam_results.rank',
                    'students.full_name as student_name',
                    'students.admission_number'
                )
                ->orderBy('student_exam_results.rank')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'student_id' => (string) $row->student_id,
                    'exam_id' => (string) $row->exam_id,
                    'obtained_marks' => (float) $row->obtained_marks,
                    'total_marks' => (float) $row->total_marks,
                    'percentage' => $row->percentage !== null ? (float) $row->percentage : null,
                    'rank' => $row->rank !== null ? (int) $row->rank : null,
                    'students' => $row->student_name ? ['full_name' => $row->student_name, 'admission_number' => $row->admission_number] : null,
                ])
            : collect();

        return response()->json([
            'exams' => $exams,
            'links' => $links,
            'syllabus' => $syllabus,
            'papers' => $papers,
            'questions' => $questions,
            'results' => $results,
        ]);
    }

    public function reportsData(Request $request): JsonResponse
    {
        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher) {
            return response()->json(['teacherId' => null, 'classes' => [], 'reports' => [], 'complaints' => []]);
        }

        $classIds = collect();
        if (Schema::hasTable('teacher_classes')) {
            $classIds = $classIds->merge(DB::table('teacher_classes')->where('teacher_id', $teacher->id)->pluck('class_id'));
        }
        $classIds = $classIds->merge(DB::table('classes')->where('class_teacher_id', $teacher->id)->pluck('id'))->unique()->values();

        $classes = DB::table('classes')
            ->whereIn('id', $classIds->all())
            ->select('id', 'name', 'section')
            ->orderBy('name')
            ->get()
            ->map(fn ($row) => ['id' => (string) $row->id, 'name' => $row->name, 'section' => $row->section]);

        $reports = collect();
        if (Schema::hasTable('student_reports') && $classIds->isNotEmpty()) {
            $reports = DB::table('student_reports')
                ->leftJoin('students', 'students.id', '=', 'student_reports.student_id')
                ->whereIn('students.class_id', $classIds->all())
                ->select(
                    'student_reports.id',
                    'student_reports.category',
                    'student_reports.description',
                    'student_reports.severity',
                    'student_reports.parent_visible',
                    'student_reports.created_at',
                    'students.full_name as student_name',
                    'students.admission_number'
                )
                ->orderByDesc('student_reports.created_at')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'category' => $row->category,
                    'description' => $row->description,
                    'severity' => $row->severity,
                    'parent_visible' => (bool) $row->parent_visible,
                    'created_at' => $row->created_at,
                    'students' => $row->student_name ? ['full_name' => $row->student_name, 'admission_number' => $row->admission_number] : null,
                ]);
        }

        $complaints = collect();
        if (Schema::hasTable('complaints')) {
            $hasVisibleTo = Schema::hasColumn('complaints', 'visible_to');
            $complaints = DB::table('complaints')
                ->orderByDesc('created_at')
                ->get()
                ->filter(function ($row) use ($hasVisibleTo) {
                    $visibleTo = $hasVisibleTo
                        ? $this->decodeVisibleTo($row->visible_to ?? null)
                        : ['admin'];

                    return in_array('teacher', $visibleTo, true);
                })
                ->map(function ($row) use ($hasVisibleTo) {
                    $visibleTo = $hasVisibleTo
                        ? $this->decodeVisibleTo($row->visible_to ?? null)
                        : ['admin'];

                    return [
                        'id' => (string) $row->id,
                        'subject' => $row->subject,
                        'description' => $row->description,
                        'status' => $row->status,
                        'response' => $row->response,
                        'visible_to' => $visibleTo,
                        'created_at' => $row->created_at,
                        'submitted_by' => $row->submitted_by ? (string) $row->submitted_by : null,
                    ];
                })
                ->values();
        }

        return response()->json([
            'teacherId' => (string) $teacher->id,
            'classes' => $classes,
            'reports' => $reports,
            'complaints' => $complaints,
        ]);
    }

    public function classStudents(Request $request): JsonResponse
    {
        $validated = $request->validate(['class_id' => ['required']]);

        $students = DB::table('students')
            ->where('class_id', $validated['class_id'])
            ->select('id', 'full_name', 'admission_number')
            ->orderBy('full_name')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'full_name' => $row->full_name,
                'admission_number' => $row->admission_number,
            ]);

        return response()->json(['students' => $students]);
    }

    public function createReport(Request $request): JsonResponse
    {
        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher) {
            return response()->json(['message' => 'Teacher not found'], 404);
        }

        $validated = $request->validate([
            'student_id' => ['required'],
            'category' => ['required', 'string', 'max:100'],
            'description' => ['required', 'string'],
            'severity' => ['nullable', 'string', 'max:30'],
            'parent_visible' => ['boolean'],
        ]);

        $id = DB::table('student_reports')->insertGetId([
            'student_id' => $validated['student_id'],
            'category' => $validated['category'],
            'description' => $validated['description'],
            'severity' => $validated['severity'] ?? 'info',
            'parent_visible' => $validated['parent_visible'] ?? true,
            'created_by' => $teacher->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if (($validated['parent_visible'] ?? true) && Schema::hasTable('student_parents') && Schema::hasTable('parents')) {
            $parentUserIds = DB::table('student_parents')
                ->join('parents', 'parents.id', '=', 'student_parents.parent_id')
                ->where('student_parents.student_id', $validated['student_id'])
                ->pluck('parents.user_id')
                ->all();

            app(NotificationService::class)->notifyUsers(
                $parentUserIds,
                'Student report shared',
                'A '.$validated['category'].' report has been shared for your child.',
                [
                    'type' => 'announcement',
                    'link' => '/parent/progress',
                    'entity_type' => 'student_report',
                    'entity_id' => $id,
                    'priority' => 'normal',
                    'channel' => 'both',
                ]
            );
        }

        return response()->json(['id' => $id], 201);
    }

    public function updateTeacherComplaint(Request $request, int $id): JsonResponse
    {
        if (! Schema::hasTable('complaints')) {
            return response()->json(['message' => 'complaints table not found'], 422);
        }

        $validated = $request->validate([
            'response' => ['nullable', 'string'],
            'status' => ['required', 'string', 'in:open,in_progress,resolved'],
        ]);

        $complaint = DB::table('complaints')->where('id', $id)->first();

        DB::table('complaints')->where('id', $id)->update([
            'response' => $validated['response'] ?? null,
            'status' => $validated['status'],
            'updated_at' => now(),
        ]);

        if ($complaint) {
            app(NotificationService::class)->notifyUsers(
                [(int) $complaint->submitted_by],
                'Complaint update',
                'Your complaint "'.$complaint->subject.'" was updated by teacher',
                [
                    'type' => 'complaint',
                    'link' => '/parent/complaints',
                    'entity_type' => 'complaint',
                    'entity_id' => $id,
                    'priority' => 'high',
                    'channel' => 'both',
                ]
            );
        }

        return response()->json(['message' => 'Updated']);
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
        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher) {
            return response()->json(['teacherId' => null, 'leaveRequests' => []]);
        }

        $rows = DB::table('leave_requests')
            ->where('teacher_id', $teacher->id)
            ->where('request_type', 'teacher')
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
            'teacherId' => (string) $teacher->id,
            'leaveRequests' => $rows,
        ]);
    }

    public function createLeaveRequest(Request $request): JsonResponse
    {
        $teacher = DB::table('teachers')->where('user_id', $request->user()->id)->first();
        if (! $teacher) {
            return response()->json(['message' => 'Teacher not found'], 404);
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
            'student_id' => null,
            'teacher_id' => $teacher->id,
            'request_type' => 'teacher',
            'from_date' => $validated['from_date'],
            'to_date' => $validated['to_date'],
            'reason' => $validated['reason'],
            'status' => 'pending',
            'approved_by' => null,
            'attachment_url' => $attachmentUrl,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $adminUserIds = DB::table('user_roles')
            ->where('role', 'admin')
            ->pluck('user_id')
            ->all();

        app(NotificationService::class)->notifyUsers(
            $adminUserIds,
            'New teacher leave request',
            'A teacher submitted leave from '.$validated['from_date'].' to '.$validated['to_date'],
            [
                'type' => 'leave',
                'link' => '/admin/leave',
                'entity_type' => 'leave_request',
                'entity_id' => $id,
                'priority' => 'high',
                'channel' => 'both',
            ]
        );

        return response()->json(['id' => $id], 201);
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
