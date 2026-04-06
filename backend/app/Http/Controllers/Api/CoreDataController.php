<?php

namespace App\Http\Controllers\Api;

use App\Support\HandlesUploadStorage;
use App\Http\Controllers\Controller;
use App\Models\ClassroomAnnouncement;
use App\Models\ParentAccount;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CoreDataController extends Controller
{
    use HandlesUploadStorage;

    public function classes(): JsonResponse
    {
        return response()->json(SchoolClass::orderBy('name')->orderBy('section')->get());
    }

    public function classManagement(): JsonResponse
    {
        $classes = DB::table('classes')
            ->leftJoin('teachers', 'teachers.id', '=', 'classes.class_teacher_id')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
            ->leftJoin('students', 'students.class_id', '=', 'classes.id')
            ->select(
                'classes.id',
                'classes.name',
                'classes.section',
                'classes.academic_year',
                'classes.class_teacher_id',
                DB::raw('COUNT(students.id) as student_count'),
                'teachers.id as teacher_id',
                'profiles.full_name as teacher_name'
            )
            ->groupBy(
                'classes.id',
                'classes.name',
                'classes.section',
                'classes.academic_year',
                'classes.class_teacher_id',
                'teachers.id',
                'profiles.full_name'
            )
            ->orderBy('classes.name')
            ->get()
            ->map(function ($row) {
                return [
                    'id' => $row->id,
                    'name' => $row->name,
                    'section' => $row->section,
                    'academic_year' => $row->academic_year,
                    'class_teacher_id' => $row->class_teacher_id,
                    'student_count' => (int) $row->student_count,
                    'class_teacher' => $row->teacher_id ? [
                        'id' => $row->teacher_id,
                        'profiles' => [
                            'full_name' => $row->teacher_name,
                        ],
                    ] : null,
                ];
            });

        return response()->json($classes);
    }

    public function teachersBasic(): JsonResponse
    {
        $teachers = DB::table('teachers')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
            ->select('teachers.id', 'teachers.user_id', 'profiles.full_name')
            ->orderBy('profiles.full_name')
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'user_id' => $row->user_id,
                'profiles' => [
                    'full_name' => $row->full_name,
                ],
            ]);

        return response()->json($teachers);
    }

    public function createClass(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'section' => ['nullable', 'string', 'max:50'],
            'academic_year' => ['nullable', 'string', 'max:30'],
            'class_teacher_id' => ['nullable', 'integer'],
        ]);

        $id = DB::table('classes')->insertGetId([
            'name' => $validated['name'],
            'section' => $validated['section'] ?? '',
            'academic_year' => $validated['academic_year'] ?? date('Y').'-'.(date('Y') + 1),
            'class_teacher_id' => $validated['class_teacher_id'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['id' => $id], 201);
    }

    public function updateClass(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'section' => ['nullable', 'string', 'max:50'],
            'academic_year' => ['nullable', 'string', 'max:30'],
            'class_teacher_id' => ['nullable', 'integer'],
        ]);

        DB::table('classes')->where('id', $id)->update([
            'name' => $validated['name'],
            'section' => $validated['section'] ?? '',
            'academic_year' => $validated['academic_year'] ?? null,
            'class_teacher_id' => $validated['class_teacher_id'] ?? null,
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Updated']);
    }

    public function deleteClass(int $id): JsonResponse
    {
        DB::table('classes')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function subjects(): JsonResponse
    {
        return response()->json(Subject::orderBy('name')->get());
    }

    public function createSubject(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:50'],
        ]);

        $id = DB::table('subjects')->insertGetId([
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'category' => $validated['category'] ?? 'general',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['id' => $id], 201);
    }

    public function updateSubject(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:50'],
        ]);

        DB::table('subjects')->where('id', $id)->update([
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'category' => $validated['category'] ?? 'general',
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Updated']);
    }

    public function deleteSubject(int $id): JsonResponse
    {
        DB::table('subjects')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function students(): JsonResponse
    {
        return response()->json(Student::orderBy('full_name')->get());
    }

    public function studentsDirectory(): JsonResponse
    {
        $students = DB::table('students')
            ->leftJoin('classes', 'classes.id', '=', 'students.class_id')
            ->select(
                'students.*',
                'classes.name as class_name',
                'classes.section as class_section'
            )
            ->orderByDesc('students.created_at')
            ->get()
            ->map(function ($row) {
                return [
                    'id' => $row->id,
                    'admission_number' => $row->admission_number,
                    'login_id' => $row->login_id,
                    'full_name' => $row->full_name,
                    'date_of_birth' => $row->date_of_birth,
                    'address' => $row->address,
                    'photo_url' => $row->photo_url,
                    'status' => $row->status,
                    'class_id' => $row->class_id,
                    'blood_group' => $row->blood_group,
                    'parent_name' => $row->parent_name,
                    'parent_phone' => $row->parent_phone,
                    'emergency_contact' => $row->emergency_contact,
                    'emergency_contact_name' => $row->emergency_contact_name,
                    'classes' => $row->class_name ? [
                        'name' => $row->class_name,
                        'section' => $row->class_section,
                    ] : null,
                ];
            });

        return response()->json($students);
    }

    public function studentAttendanceSummary(int $studentId): JsonResponse
    {
        $thirtyDaysAgo = now()->subDays(30)->toDateString();
        $records = DB::table('attendance')
            ->select('id', 'date', 'status')
            ->where('student_id', $studentId)
            ->whereDate('date', '>=', $thirtyDaysAgo)
            ->orderByDesc('date')
            ->get();

        return response()->json($records);
    }

    public function teachers(): JsonResponse
    {
        return response()->json(Teacher::orderBy('teacher_id')->get());
    }

    public function parents(): JsonResponse
    {
        return response()->json(ParentAccount::orderByDesc('id')->get());
    }

    public function announcements(): JsonResponse
    {
        return response()->json(ClassroomAnnouncement::orderByDesc('created_at')->get());
    }

    public function createAnnouncement(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
            'target_audience' => ['nullable', 'array'],
        ]);

        $announcement = ClassroomAnnouncement::create([
            'title' => $validated['title'],
            'content' => $validated['content'],
            'target_audience' => $validated['target_audience'] ?? ['all'],
            'created_by' => $request->user()->id,
        ]);

        $targets = collect($validated['target_audience'] ?? ['all'])
            ->map(fn ($v) => strtolower((string) $v))
            ->values();

        $roles = ['admin', 'teacher', 'parent'];
        if (! $targets->contains('all')) {
            $roles = $targets->filter(fn ($r) => in_array($r, ['admin', 'teacher', 'parent'], true))->values()->all();
            if (empty($roles)) {
                $roles = ['admin', 'teacher', 'parent'];
            }
        }

        $recipientIds = DB::table('user_roles')
            ->whereIn('role', $roles)
            ->pluck('user_id')
            ->all();

        app(NotificationService::class)->notifyUsers(
            $recipientIds,
            'New announcement',
            $announcement->title,
            [
                'type' => 'announcement',
                'link' => '/admin/announcements',
                'entity_type' => 'announcement',
                'entity_id' => $announcement->id,
                'priority' => 'normal',
                'channel' => 'both',
            ]
        );

        return response()->json($announcement, 201);
    }

    public function attendanceReport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start' => ['required', 'date'],
            'end' => ['required', 'date'],
            'class_id' => ['nullable', 'integer'],
        ]);

        $query = DB::table('attendance')
            ->join('students', 'students.id', '=', 'attendance.student_id')
            ->whereDate('attendance.date', '>=', $validated['start'])
            ->whereDate('attendance.date', '<=', $validated['end'])
            ->select(
                'attendance.id',
                'attendance.student_id',
                'attendance.date',
                'attendance.status',
                'attendance.session',
                'attendance.reason',
                'attendance.class_id_snapshot',
                'attendance.class_name_snapshot',
                'attendance.class_section_snapshot',
                'students.full_name as student_full_name',
                'students.admission_number',
                'students.class_id',
                'students.class_id as current_class_id'
            )
            ->orderByDesc('attendance.created_at');

        if (! empty($validated['class_id'])) {
            $query->where('attendance.class_id_snapshot', $validated['class_id']);
        }

        $rows = $query->get()->map(function ($row) {
            return [
                'id' => $row->id,
                'student_id' => $row->student_id,
                'date' => $row->date,
                'status' => $row->status,
                'session' => $row->session,
                'reason' => $row->reason,
                'students' => [
                    'full_name' => $row->student_full_name,
                    'admission_number' => $row->admission_number,
                    'class_id' => $row->class_id_snapshot ?? $row->current_class_id,
                    'classes' => $row->class_name_snapshot ? [
                        'name' => $row->class_name_snapshot,
                        'section' => $row->class_section_snapshot,
                    ] : null,
                ],
            ];
        });

        return response()->json($rows);
    }

    public function deleteAnnouncement(int $id): JsonResponse
    {
        $announcement = ClassroomAnnouncement::findOrFail($id);
        $announcement->delete();

        return response()->json(['message' => 'Deleted']);
    }

    public function complaintsManagement(): JsonResponse
    {
        if (! Schema::hasTable('complaints')) {
            return response()->json([]);
        }

        $rows = DB::table('complaints')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($row) {
                $visibleTo = ['admin'];
                if (property_exists($row, 'visible_to')) {
                    $visibleTo = $this->decodeVisibleTo($row->visible_to);
                }

                return [
                    'id' => $row->id,
                    'subject' => $row->subject,
                    'description' => $row->description,
                    'status' => $row->status,
                    'response' => $row->response,
                    'created_at' => $row->created_at,
                    'submitted_by' => $row->submitted_by,
                    'visible_to' => $visibleTo,
                ];
            });

        return response()->json($rows);
    }

    public function updateComplaint(Request $request, int $id): JsonResponse
    {
        if (! Schema::hasTable('complaints')) {
            return response()->json(['message' => 'complaints table not found'], 422);
        }

        $validated = $request->validate([
            'status' => ['nullable', 'string', 'max:30'],
            'response' => ['nullable', 'string'],
        ]);

        $updateData = ['updated_at' => now()];
        if (array_key_exists('status', $validated)) {
            $updateData['status'] = $validated['status'];
        }
        if (array_key_exists('response', $validated)) {
            $updateData['response'] = $validated['response'];
        }

        $complaint = DB::table('complaints')->where('id', $id)->first();
        DB::table('complaints')->where('id', $id)->update($updateData);

        if ($complaint) {
            $message = 'Your complaint "'.$complaint->subject.'" is now '.($validated['status'] ?? $complaint->status);
            app(NotificationService::class)->notifyUsers([(int) $complaint->submitted_by], 'Complaint update', $message, [
                'type' => 'complaint',
                'link' => '/parent/complaints',
                'entity_type' => 'complaint',
                'entity_id' => $id,
                'priority' => 'high',
                'channel' => 'both',
            ]);
        }

        return response()->json(['message' => 'Updated']);
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

    public function certificateRequests(): JsonResponse
    {
        if (! Schema::hasTable('certificate_requests')) {
            return response()->json([]);
        }

        $hasDescription = Schema::hasColumn('certificate_requests', 'description');
        $hasAdminRemarks = Schema::hasColumn('certificate_requests', 'admin_remarks');

        $rows = DB::table('certificate_requests')
            ->leftJoin('students', 'students.id', '=', 'certificate_requests.student_id')
            ->leftJoin('classes', 'classes.id', '=', 'students.class_id')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'certificate_requests.requested_by')
            ->select(
                'certificate_requests.*',
                'students.full_name as student_full_name',
                'students.admission_number as student_admission_number',
                'classes.name as class_name',
                'classes.section as class_section',
                'profiles.full_name as requester_name'
            )
            ->orderByDesc('certificate_requests.created_at')
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'certificate_type' => $row->certificate_type,
                'status' => $row->status,
                'created_at' => $row->created_at,
                'student_id' => $row->student_id,
                'requested_by' => $row->requested_by,
                'approved_by' => $row->approved_by,
                'attachment_url' => $this->normalizeLegacyAttachmentUrl($row->attachment_url),
                'description' => $hasDescription ? ($row->description ?? null) : null,
                'admin_remarks' => $hasAdminRemarks ? ($row->admin_remarks ?? null) : null,
                'requester_name' => $row->requester_name,
                'student' => $row->student_full_name ? [
                    'full_name' => $row->student_full_name,
                    'admission_number' => $row->student_admission_number,
                    'classes' => $row->class_name ? [
                        'name' => $row->class_name,
                        'section' => $row->class_section,
                    ] : null,
                ] : null,
            ]);

        return response()->json($rows);
    }

    public function updateCertificateRequest(Request $request, int $id): JsonResponse
    {
        if (! Schema::hasTable('certificate_requests')) {
            return response()->json(['message' => 'certificate_requests table not found'], 422);
        }

        $validated = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
            'approved_by' => ['nullable', 'integer'],
            'admin_remarks' => ['nullable', 'string'],
        ]);

        $update = [
            'status' => $validated['status'],
            'approved_by' => $validated['approved_by'] ?? null,
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('certificate_requests', 'admin_remarks')) {
            $update['admin_remarks'] = $validated['admin_remarks'] ?? null;
        }

        $certificate = DB::table('certificate_requests')->where('id', $id)->first();
        DB::table('certificate_requests')->where('id', $id)->update($update);

        if ($certificate && $certificate->requested_by) {
            $title = 'Certificate request '.$validated['status'];
            $message = 'Your '.$certificate->certificate_type.' request is '.$validated['status'];
            app(NotificationService::class)->notifyUsers([(int) $certificate->requested_by], $title, $message, [
                'type' => 'certificate',
                'link' => '/parent/certificates',
                'entity_type' => 'certificate_request',
                'entity_id' => $id,
                'priority' => 'high',
                'channel' => 'both',
            ]);
        }

        return response()->json(['message' => 'Updated']);
    }

    public function leaveRequests(): JsonResponse
    {
        $rows = DB::table('leave_requests')
            ->leftJoin('students', 'students.id', '=', 'leave_requests.student_id')
            ->leftJoin('teachers', 'teachers.id', '=', 'leave_requests.teacher_id')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
            ->select(
                'leave_requests.*',
                'students.full_name as student_name',
                'profiles.full_name as teacher_name'
            )
            ->orderByDesc('leave_requests.created_at')
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'request_type' => $row->request_type,
                'from_date' => $row->from_date,
                'to_date' => $row->to_date,
                'reason' => $row->reason,
                'status' => $row->status,
                'created_at' => $row->created_at,
                'student_id' => $row->student_id,
                'teacher_id' => $row->teacher_id,
                'attachment_url' => $this->normalizeLegacyAttachmentUrl($row->attachment_url),
                'students' => $row->student_name ? ['full_name' => $row->student_name] : null,
                'teachers' => $row->teacher_name ? ['profiles' => ['full_name' => $row->teacher_name]] : null,
            ]);

        return response()->json($rows);
    }

    public function updateLeaveRequest(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:approved,rejected,pending'],
        ]);

        $approvedBy = $validated['status'] === 'pending' ? null : $request->user()->id;

        DB::table('leave_requests')->where('id', $id)->update([
            'status' => $validated['status'],
            'approved_by' => $approvedBy,
            'updated_at' => now(),
        ]);

        $leave = DB::table('leave_requests')->where('id', $id)->first();
        if ($leave) {
            $recipientIds = [];
            $link = '/parent/leave';

            if ($leave->request_type === 'teacher' && $leave->teacher_id) {
                $teacherUserId = DB::table('teachers')->where('id', $leave->teacher_id)->value('user_id');
                if ($teacherUserId) {
                    $recipientIds[] = (int) $teacherUserId;
                }
                $link = '/teacher/leave';
            }

            if ($leave->request_type === 'student' && $leave->student_id) {
                $parentUserIds = DB::table('student_parents')
                    ->join('parents', 'parents.id', '=', 'student_parents.parent_id')
                    ->where('student_parents.student_id', $leave->student_id)
                    ->pluck('parents.user_id')
                    ->all();
                foreach ($parentUserIds as $userId) {
                    $recipientIds[] = (int) $userId;
                }
            }

            app(NotificationService::class)->notifyUsers(
                $recipientIds,
                'Leave request '.$validated['status'],
                'Your leave request from '.$leave->from_date.' to '.$leave->to_date.' is '.$validated['status'],
                [
                    'type' => 'leave',
                    'link' => $link,
                    'entity_type' => 'leave_request',
                    'entity_id' => $id,
                    'priority' => 'high',
                    'channel' => 'both',
                ]
            );
        }

        return response()->json(['message' => 'Updated']);
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
