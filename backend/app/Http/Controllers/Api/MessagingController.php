<?php

namespace App\Http\Controllers\Api;

use App\Support\HandlesUploadStorage;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class MessagingController extends Controller
{
    use HandlesUploadStorage;

    public function classes(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = DB::table('user_roles')->where('user_id', $user->id)->value('role');

        if ($role === 'teacher') {
            $teacherId = DB::table('teachers')->where('user_id', $user->id)->value('id');
            if (! $teacherId) {
                return response()->json([]);
            }

            $rows = DB::table('classes')
                ->whereIn('id', function ($query) use ($teacherId): void {
                    $query->select('class_id')->from('teacher_classes')->where('teacher_id', $teacherId);
                })
                ->orWhere('class_teacher_id', $teacherId)
                ->select('id', 'name', 'section')
                ->orderBy('name')
                ->orderBy('section')
                ->get()
                ->unique('id')
                ->values()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'name' => $row->name,
                    'section' => $row->section,
                ]);

            return response()->json($rows);
        }

        $rows = DB::table('classes')
            ->select('id', 'name', 'section')
            ->orderBy('name')
            ->orderBy('section')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'name' => $row->name,
                'section' => $row->section,
            ]);

        return response()->json($rows);
    }

    public function teachers(Request $request): JsonResponse
    {
        $currentUserId = $request->user()->id;

        $rows = DB::table('teachers')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
            ->where('teachers.status', 'active')
            ->where('teachers.user_id', '!=', $currentUserId)
            ->select('teachers.id', 'teachers.user_id', 'teachers.teacher_id', 'profiles.full_name')
            ->orderBy('teachers.teacher_id')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'userId' => (string) $row->user_id,
                'name' => $row->full_name ?: 'Teacher',
                'teacherId' => $row->teacher_id,
            ]);

        return response()->json($rows);
    }

    public function adminUser(): JsonResponse
    {
        $adminUserId = DB::table('user_roles')->where('role', 'admin')->value('user_id');
        if (! $adminUserId) {
            return response()->json(null);
        }

        $profile = DB::table('profiles')->where('user_id', $adminUserId)->first();

        return response()->json([
            'userId' => (string) $adminUserId,
            'name' => $profile?->full_name ?: 'Admin',
            'avatar' => $profile?->photo_url,
        ]);
    }

    public function studentsByClass(Request $request, int $classId): JsonResponse
    {
        $role = $this->userRole($request->user()->id);
        if (! in_array($role, ['admin', 'teacher'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($role === 'teacher') {
            $teacherId = DB::table('teachers')->where('user_id', $request->user()->id)->value('id');
            if (! $teacherId) {
                return response()->json([]);
            }

            $hasAccess = DB::table('classes')
                ->where('id', $classId)
                ->where(function ($query) use ($teacherId): void {
                    $query->where('class_teacher_id', $teacherId)
                        ->orWhereIn('id', function ($sub) use ($teacherId): void {
                            $sub->select('class_id')->from('teacher_classes')->where('teacher_id', $teacherId);
                        });
                })
                ->exists();

            if (! $hasAccess) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $students = DB::table('students as s')
            ->leftJoin('student_parents as sp', 'sp.student_id', '=', 's.id')
            ->leftJoin('parents as p', 'p.id', '=', 'sp.parent_id')
            ->leftJoin('profiles as pr', 'pr.user_id', '=', 'p.user_id')
            ->where('s.class_id', $classId)
            ->select('s.id', 's.full_name', 'p.user_id as parent_user_id', 'pr.full_name as parent_name')
            ->orderBy('s.full_name')
            ->get()
            ->map(fn ($student) => [
                'id' => (string) $student->id,
                'full_name' => $student->full_name,
                'parentUserId' => $student->parent_user_id ? (string) $student->parent_user_id : null,
                'parentName' => $student->parent_name,
            ]);

        return response()->json($students);
    }

    public function contacts(Request $request): JsonResponse
    {
        if (! Schema::hasTable('messages')) {
            return response()->json([]);
        }

        $currentUserId = $request->user()->id;
        $role = $this->userRole($currentUserId);

        $messages = DB::table('messages')
            ->where('sender_id', $currentUserId)
            ->orWhere('recipient_id', $currentUserId)
            ->select('sender_id', 'recipient_id', 'student_id')
            ->get();

        $seen = [];
        $contactKeys = [];
        $otherIds = [];
        $studentIds = [];

        foreach ($messages as $msg) {
            $otherId = (string) ($msg->sender_id == $currentUserId ? $msg->recipient_id : $msg->sender_id);
            $studentId = $msg->student_id ? (string) $msg->student_id : null;
            $key = $otherId.'|'.($studentId ?? '');
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $contactKeys[] = ['otherId' => $otherId, 'studentId' => $studentId];
            $otherIds[$otherId] = $otherId;
            if ($studentId) {
                $studentIds[$studentId] = $studentId;
            }
        }

        $profiles = empty($otherIds) ? collect() : DB::table('profiles')
            ->whereIn('user_id', array_values($otherIds))
            ->select('user_id', 'full_name', 'photo_url')
            ->get()
            ->keyBy(fn ($row) => (string) $row->user_id);

        $roles = empty($otherIds) ? collect() : DB::table('user_roles')
            ->whereIn('user_id', array_values($otherIds))
            ->select('user_id', 'role')
            ->get()
            ->groupBy(fn ($row) => (string) $row->user_id);

        $parentUserSet = empty($otherIds) ? [] : DB::table('parents')
            ->whereIn('user_id', array_values($otherIds))
            ->pluck('user_id')
            ->map(fn ($id) => (string) $id)
            ->flip()
            ->all();

        $studentsById = empty($studentIds) ? collect() : DB::table('students')
            ->whereIn('id', array_values($studentIds))
            ->select('id', 'full_name')
            ->get()
            ->keyBy(fn ($row) => (string) $row->id);

        $contacts = collect($contactKeys)->map(function (array $item) use ($profiles, $roles, $parentUserSet, $studentsById) {
            $otherId = $item['otherId'];
            $studentId = $item['studentId'];

            $profile = $profiles->get($otherId);
            $roleRows = $roles->get($otherId, collect());
            $isAdmin = $roleRows->contains(fn ($r) => $r->role === 'admin');
            $isParent = isset($parentUserSet[$otherId]);

            $contactRole = 'teacher';
            if ($isAdmin) {
                $contactRole = 'admin';
            } elseif ($isParent) {
                $contactRole = 'parent';
            }

            return [
                'id' => $otherId,
                'name' => $profile?->full_name ?: 'User',
                'role' => $contactRole,
                'roleLabel' => $isAdmin ? 'Principal' : null,
                'avatar' => $profile?->photo_url,
                'studentId' => $studentId,
                'studentName' => $studentId ? ($studentsById->get($studentId)?->full_name ?? null) : null,
            ];
        })->values()->all();

        if ($role === 'parent' && empty($contacts)) {
            $parentId = DB::table('parents')->where('user_id', $currentUserId)->value('id');
            if ($parentId) {
                $student = DB::table('student_parents')
                    ->join('students', 'students.id', '=', 'student_parents.student_id')
                    ->where('student_parents.parent_id', $parentId)
                    ->select('students.id', 'students.full_name', 'students.class_id')
                    ->first();

                if ($student) {
                    $adminUserId = DB::table('user_roles')->where('role', 'admin')->value('user_id');
                    if ($adminUserId) {
                        $adminProfile = DB::table('profiles')->where('user_id', $adminUserId)->first();
                        $contacts[] = [
                            'id' => (string) $adminUserId,
                            'name' => $adminProfile?->full_name ?: 'Principal',
                            'role' => 'admin',
                            'roleLabel' => 'Principal',
                            'avatar' => $adminProfile?->photo_url,
                            'studentId' => (string) $student->id,
                            'studentName' => $student->full_name,
                        ];
                    }
                }
            }
        }

        return response()->json($contacts);
    }

    public function messages(Request $request): JsonResponse
    {
        if (! Schema::hasTable('messages')) {
            return response()->json([]);
        }

        $validated = $request->validate([
            'contact_id' => ['required'],
            'student_id' => ['nullable'],
            'after_id' => ['nullable', 'integer', 'min:1'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $currentUserId = $request->user()->id;
        $contactId = $validated['contact_id'];

        $rows = DB::table('messages')
            ->where(function ($query) use ($currentUserId, $contactId): void {
                $query->where('sender_id', $currentUserId)->where('recipient_id', $contactId);
            })
            ->orWhere(function ($query) use ($currentUserId, $contactId): void {
                $query->where('sender_id', $contactId)->where('recipient_id', $currentUserId);
            });

        if (! empty($validated['student_id'])) {
            $rows = $rows->where('student_id', $validated['student_id']);
        }

        if (! empty($validated['after_id'])) {
            $rows = $rows->where('id', '>', (int) $validated['after_id']);
        }

        $rows = $rows->orderBy('id')
            ->limit((int) ($validated['limit'] ?? 200))
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'sender_id' => (string) $row->sender_id,
                'recipient_id' => (string) $row->recipient_id,
                'student_id' => $row->student_id ? (string) $row->student_id : null,
                'content' => $row->content,
                'is_read' => (bool) $row->is_read,
                'created_at' => $row->created_at,
                'attachment_url' => $row->attachment_url ? $this->normalizeAttachmentUrl($row->attachment_url) : null,
                'attachment_type' => $row->attachment_type,
            ]);

        return response()->json($rows);
    }

    public function send(Request $request): JsonResponse
    {
        if (! Schema::hasTable('messages')) {
            return response()->json(['message' => 'messages table not found'], 422);
        }

        $validated = $request->validate([
            'recipient_id' => ['required'],
            'student_id' => ['nullable'],
            'content' => ['nullable', 'string'],
            'attachment' => ['nullable', 'file', 'max:10240'],
        ]);

        $attachmentUrl = null;
        $attachmentType = null;

        if ($request->hasFile('attachment')) {
            try {
                $file = $request->file('attachment');
                $path = $this->storeUploadedFile(
                    $file,
                    'message-attachments/'.(string) $request->user()->id
                );

                if (! is_string($path) || trim($path) === '') {
                    throw new \RuntimeException('Upload completed without returning an object path.');
                }

                $attachmentUrl = $this->buildPublicUploadUrl($path);

                Log::info('Message attachment stored', [
                    'user_id' => $request->user()->id,
                    'disk' => $this->uploadDisk(),
                    'path' => $path,
                    'url' => $attachmentUrl,
                ]);

                $attachmentType = $this->detectAttachmentType($file);
            } catch (\Throwable $e) {
                Log::error('Message attachment upload failed', [
                    'user_id' => $request->user()->id,
                    'disk' => $this->uploadDisk(),
                    'filename' => $request->file('attachment')?->getClientOriginalName(),
                    'mime' => $request->file('attachment')?->getMimeType(),
                    'message' => $e->getMessage(),
                ]);

                return response()->json(['message' => 'Attachment upload failed. Please check storage permissions.'], 422);
            }
        }

        $content = trim((string) ($validated['content'] ?? ''));
        if ($content === '' && $attachmentType === null) {
            return response()->json(['message' => 'Message cannot be empty'], 422);
        }

        if ($content === '') {
            $content = $attachmentType === 'image' ? '📷 Image' : '📎 Document';
        }

        $id = DB::table('messages')->insertGetId([
            'sender_id' => $request->user()->id,
            'recipient_id' => $validated['recipient_id'],
            'student_id' => $validated['student_id'] ?? null,
            'content' => $content,
            'is_read' => false,
            'attachment_url' => $attachmentUrl,
            'attachment_type' => $attachmentType,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['id' => (string) $id], 201);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        if (! Schema::hasTable('messages')) {
            return response()->json(['message' => 'messages table not found'], 422);
        }

        DB::table('messages')
            ->where('id', $id)
            ->where('recipient_id', $request->user()->id)
            ->update(['is_read' => true, 'updated_at' => now()]);

        return response()->json(['message' => 'Read']);
    }

    private function userRole(string $userId): ?string
    {
        return DB::table('user_roles')->where('user_id', $userId)->value('role');
    }

    private function normalizeAttachmentUrl(string $url): string
    {
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

    private function detectAttachmentType($file): string
    {
        $mime = Str::lower((string) $file->getMimeType());
        $extension = Str::lower((string) ($file->getClientOriginalExtension() ?: $file->extension()));

        if (str_starts_with($mime, 'image/')) {
            return 'image';
        }

        if (in_array($extension, ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'], true)) {
            return 'image';
        }

        return 'document';
    }

    private function buildPublicUploadUrl(string $path): string
    {
        return $this->buildUploadUrl($path);
    }
}
