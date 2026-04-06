<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class AdminSettingsController extends Controller
{
    public function paymentGateway(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Schema::hasTable('app_settings')) {
            return response()->json([
                'razorpay_key_id' => '',
                'razorpay_key_secret' => '',
            ]);
        }

        $rows = DB::table('app_settings')
            ->whereIn('setting_key', ['razorpay_key_id', 'razorpay_key_secret'])
            ->select('setting_key', 'setting_value')
            ->get();

        $keyId = $rows->firstWhere('setting_key', 'razorpay_key_id')->setting_value ?? '';
        $keySecret = $rows->firstWhere('setting_key', 'razorpay_key_secret')->setting_value ?? '';

        return response()->json([
            'razorpay_key_id' => $this->normalizeSettingValue($keyId),
            'razorpay_key_secret' => $this->normalizeSettingValue($keySecret),
        ]);
    }

    public function updatePaymentGateway(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'razorpay_key_id' => ['required', 'string'],
            'razorpay_key_secret' => ['required', 'string'],
        ]);

        if (! Schema::hasTable('app_settings')) {
            return response()->json(['message' => 'app_settings table not found'], 422);
        }

        DB::table('app_settings')->updateOrInsert(
            ['setting_key' => 'razorpay_key_id'],
            ['setting_value' => $validated['razorpay_key_id'], 'updated_by' => $request->user()->id, 'updated_at' => now()]
        );
        DB::table('app_settings')->updateOrInsert(
            ['setting_key' => 'razorpay_key_secret'],
            ['setting_value' => $validated['razorpay_key_secret'], 'updated_by' => $request->user()->id, 'updated_at' => now()]
        );

        return response()->json(['message' => 'Saved']);
    }

    public function inviteAdmin(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'full_name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:6'],
        ]);

        $user = User::create([
            'name' => $validated['full_name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        Profile::create([
            'user_id' => $user->id,
            'full_name' => $validated['full_name'],
            'email' => $validated['email'],
        ]);

        UserRole::create([
            'user_id' => $user->id,
            'role' => 'admin',
        ]);

        return response()->json(['message' => 'Admin created'], 201);
    }

    public function factoryReset(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $tables = [
            'exam_marks',
            'exams',
            'attendance',
            'homework',
            'fees',
            'leave_requests',
            'certificate_requests',
            'complaints',
            'student_reports',
            'messages',
            'timetable',
            'announcements',
            'student_parents',
            'students',
            'teacher_classes',
            'teachers',
            'parents',
            'classes',
            'subjects',
            'lead_call_logs',
            'lead_status_history',
            'leads',
            'syllabus',
            'teacher_syllabus_map',
            'weekly_exams',
            'weekly_exam_syllabus_links',
        ];

        DB::transaction(function () use ($tables): void {
            foreach ($tables as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->delete();
                }
            }
        });

        return response()->json(['message' => 'Factory reset complete']);
    }

    public function fullReset(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->factoryReset($request);

        DB::transaction(function (): void {
            if (Schema::hasTable('teacher_lead_permissions')) {
                DB::table('teacher_lead_permissions')->delete();
            }

            if (Schema::hasTable('settings_audit_log')) {
                DB::table('settings_audit_log')->delete();
            }

            if (Schema::hasTable('profiles')) {
                DB::table('profiles')->delete();
            }

            if (Schema::hasTable('user_roles')) {
                DB::table('user_roles')->delete();
            }

            if (Schema::hasTable('users')) {
                DB::table('users')->delete();
            }
        });

        return response()->json(['message' => 'Full reset complete']);
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

    private function isAdmin(Request $request): bool
    {
        return DB::table('user_roles')->where('user_id', $request->user()->id)->value('role') === 'admin';
    }
}
