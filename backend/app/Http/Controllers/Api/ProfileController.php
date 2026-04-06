<?php

namespace App\Http\Controllers\Api;

use App\Support\HandlesUploadStorage;
use App\Http\Controllers\Controller;
use App\Models\ParentAccount;
use App\Models\Profile;
use App\Models\Teacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    use HandlesUploadStorage;

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->role?->role;

        $profile = Profile::firstOrCreate(
            ['user_id' => $user->id],
            ['full_name' => $user->name, 'email' => $user->email]
        );

        $payload = [
            'full_name' => $profile->full_name,
            'email' => $profile->email ?: $user->email,
            'phone' => $profile->phone,
            'photo_url' => $profile->photo_url,
            'role' => $role,
            'teacherId' => null,
            'qualification' => null,
            'subjects' => [],
            'joiningDate' => null,
            'status' => null,
            'assignedClasses' => [],
            'childrenNames' => [],
        ];

        if ($role === 'teacher') {
            $teacher = Teacher::where('user_id', $user->id)->first();
            if ($teacher) {
                $payload['teacherId'] = $teacher->teacher_id;
                $payload['qualification'] = $teacher->qualification;
                $payload['subjects'] = $teacher->subjects ?: [];
                $payload['joiningDate'] = $teacher->joining_date?->toDateString();
                $payload['status'] = $teacher->status;
                $payload['assignedClasses'] = \DB::table('teacher_classes')
                    ->join('classes', 'classes.id', '=', 'teacher_classes.class_id')
                    ->where('teacher_classes.teacher_id', $teacher->id)
                    ->selectRaw("CONCAT(classes.name, ' - ', classes.section) AS label")
                    ->pluck('label')
                    ->all();
            }
        }

        if ($role === 'parent') {
            $parent = ParentAccount::where('user_id', $user->id)->first();
            if ($parent) {
                if ($parent->phone && ! $payload['phone']) {
                    $payload['phone'] = $parent->phone;
                }

                $payload['childrenNames'] = \DB::table('student_parents')
                    ->join('students', 'students.id', '=', 'student_parents.student_id')
                    ->where('student_parents.parent_id', $parent->id)
                    ->pluck('students.full_name')
                    ->all();
            }
        }

        return response()->json($payload);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $profile = Profile::firstOrCreate(
            ['user_id' => $request->user()->id],
            ['full_name' => $request->user()->name, 'email' => $request->user()->email]
        );

        $profile->phone = $validated['phone'] ?? null;
        $profile->save();

        return response()->json(['message' => 'Profile updated']);
    }

    public function uploadPhoto(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'photo' => ['required', 'image', 'max:5120'],
        ]);

        $user = $request->user();
        $profile = Profile::firstOrCreate(
            ['user_id' => $user->id],
            ['full_name' => $user->name, 'email' => $user->email]
        );

        $path = $validated['photo']->store('avatars', $this->uploadDisk());
        $url = $this->buildUploadUrl($path);

        $profile->photo_url = $url;
        $profile->save();

        return response()->json(['photo_url' => $url]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'min:6'],
        ]);

        $user = $request->user();
        $user->password = Hash::make($validated['password']);
        $user->save();

        return response()->json(['message' => 'Password updated']);
    }
}
