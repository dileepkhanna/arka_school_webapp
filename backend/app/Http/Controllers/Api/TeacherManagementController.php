<?php

namespace App\Http\Controllers\Api;

use App\Support\HandlesUploadStorage;
use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Models\Teacher;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class TeacherManagementController extends Controller
{
    use HandlesUploadStorage;

    public function index(): JsonResponse
    {
        $teachers = Teacher::query()->orderByDesc('created_at')->get();

        $items = $teachers->map(function (Teacher $teacher) {
            $profile = Profile::where('user_id', $teacher->user_id)->first();

            $classTeacherOf = DB::table('classes')
                ->select('id', 'name', 'section')
                ->where('class_teacher_id', $teacher->id)
                ->get();

            $assigned = DB::table('teacher_classes')
                ->join('classes', 'classes.id', '=', 'teacher_classes.class_id')
                ->where('teacher_classes.teacher_id', $teacher->id)
                ->select('classes.id', 'classes.name', 'classes.section')
                ->get();

            $assignedClasses = collect($classTeacherOf)
                ->concat($assigned)
                ->unique(fn ($c) => (int) $c->id)
                ->values()
                ->all();

            return [
                'id' => $teacher->id,
                'teacher_id' => $teacher->teacher_id,
                'qualification' => $teacher->qualification,
                'subjects' => $teacher->subjects ?: [],
                'joining_date' => $teacher->joining_date,
                'status' => $teacher->status,
                'user_id' => $teacher->user_id,
                'profiles' => $profile ? [
                    'full_name' => $profile->full_name,
                    'email' => $profile->email,
                    'phone' => $profile->phone,
                    'photo_url' => $profile->photo_url,
                ] : null,
                'assigned_classes' => $assignedClasses,
            ];
        });

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['required', 'string', 'min:10', 'max:30'],
            'qualification' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:6'],
            'subjects' => ['required', 'string'],
            'class_teacher_of' => ['nullable', 'integer'],
            'photo' => ['nullable', 'image', 'max:5120'],
        ]);

        $email = $validated['email'] ?: strtolower(str_replace(' ', '.', $validated['full_name'])).'.'.time().'@school.internal';

        if (User::where('email', $email)->exists()) {
            return response()->json(['message' => 'Email already exists'], 422);
        }

        $user = User::create([
            'name' => $validated['full_name'],
            'email' => $email,
            'password' => Hash::make($validated['password']),
        ]);

        UserRole::updateOrCreate(
            ['user_id' => $user->id],
            ['role' => 'teacher']
        );

        $photoUrl = null;
        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('teachers', $this->uploadDisk());
            $photoUrl = $this->buildUploadUrl($path);
        }

        Profile::updateOrCreate(
            ['user_id' => $user->id],
            [
                'full_name' => $validated['full_name'],
                'email' => $email,
                'phone' => $validated['phone'],
                'photo_url' => $photoUrl,
            ]
        );

        $subjects = $validated['subjects']
            ? collect(explode(',', $validated['subjects']))->map(fn ($s) => trim($s))->filter()->values()->all()
            : [];

        if (count($subjects) === 0) {
            return response()->json(['message' => 'At least one subject is required'], 422);
        }

        $teacher = Teacher::create([
            'user_id' => $user->id,
            'teacher_id' => $this->buildTeacherId($validated['full_name'], $subjects),
            'qualification' => $validated['qualification'],
            'subjects' => $subjects,
            'status' => 'active',
            'joining_date' => now()->toDateString(),
        ]);

        if (! empty($validated['class_teacher_of'])) {
            DB::table('classes')->where('id', $validated['class_teacher_of'])->update([
                'class_teacher_id' => $teacher->id,
                'updated_at' => now(),
            ]);
        }

        return response()->json(['id' => $teacher->id], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'qualification' => ['nullable', 'string', 'max:255'],
            'subjects' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'max:30'],
            'class_teacher_of' => ['nullable', 'integer'],
            'password' => ['nullable', 'string', 'min:6'],
        ]);

        $teacher = Teacher::findOrFail($id);

        Profile::where('user_id', $teacher->user_id)->update([
            'full_name' => $validated['full_name'],
            'phone' => $validated['phone'] ?? null,
            'updated_at' => now(),
        ]);

        if (! empty($validated['password'])) {
            User::where('id', $teacher->user_id)->update([
                'password' => Hash::make($validated['password']),
                'updated_at' => now(),
            ]);
        }

        $subjects = $validated['subjects']
            ? collect(explode(',', $validated['subjects']))->map(fn ($s) => trim($s))->filter()->values()->all()
            : [];

        $teacher->qualification = $validated['qualification'] ?? $teacher->qualification;
        $teacher->subjects = $subjects;
        $teacher->status = $validated['status'] ?? $teacher->status;
        $teacher->save();

        DB::table('classes')->where('class_teacher_id', $teacher->id)->update([
            'class_teacher_id' => null,
            'updated_at' => now(),
        ]);

        if (! empty($validated['class_teacher_of'])) {
            DB::table('classes')->where('id', $validated['class_teacher_of'])->update([
                'class_teacher_id' => $teacher->id,
                'updated_at' => now(),
            ]);
        }

        return response()->json(['message' => 'Updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        DB::table('classes')->where('class_teacher_id', $id)->update([
            'class_teacher_id' => null,
            'updated_at' => now(),
        ]);

        Teacher::where('id', $id)->delete();

        return response()->json(['message' => 'Deleted']);
    }

    private function buildTeacherId(string $fullName, array $subjects): string
    {
        $namePart = collect(preg_split('/\s+/', trim($fullName)) ?: [])
            ->map(fn ($part) => preg_replace('/[^A-Z0-9]/', '', strtoupper($part)))
            ->filter()
            ->implode('-');

        $subject = $subjects[0] ?? 'GEN';
        $subjectPart = preg_replace('/[^A-Z0-9]/', '', strtoupper($subject));

        $base = ($namePart ?: 'NAME').'-'.($subjectPart ?: 'GEN');
        $candidate = $base;
        $counter = 1;

        while (Teacher::where('teacher_id', $candidate)->exists()) {
            $counter++;
            $candidate = $base.'-'.$counter;
        }

        return $candidate;
    }
}
