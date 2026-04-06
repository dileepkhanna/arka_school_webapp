<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LeadsController extends Controller
{
    public function index(): JsonResponse
    {
        if (! Schema::hasTable('leads')) {
            return response()->json([]);
        }

        $rows = DB::table('leads')->orderByDesc('created_at')->get()->map(fn ($row) => (array) $row);

        return response()->json($rows);
    }

    public function details(int $id): JsonResponse
    {
        $callLogs = Schema::hasTable('lead_call_logs')
            ? DB::table('lead_call_logs')->where('lead_id', $id)->orderByDesc('created_at')->get()->map(fn ($row) => (array) $row)
            : collect();

        $statusHistory = Schema::hasTable('lead_status_history')
            ? DB::table('lead_status_history')->where('lead_id', $id)->orderByDesc('created_at')->get()->map(fn ($row) => (array) $row)
            : collect();

        return response()->json([
            'callLogs' => $callLogs,
            'statusHistory' => $statusHistory,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! Schema::hasTable('leads')) {
            return response()->json(['message' => 'Leads table not found'], 422);
        }

        $payload = $request->all();
        unset($payload['id']);
        $payload['created_by'] = $request->user()->id;
        $payload['created_at'] = now();
        $payload['updated_at'] = now();

        $id = DB::table('leads')->insertGetId($payload);

        return response()->json(['id' => $id], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! Schema::hasTable('leads')) {
            return response()->json(['message' => 'Leads table not found'], 422);
        }

        $payload = $request->all();
        unset($payload['id'], $payload['created_by'], $payload['created_at']);
        $payload['updated_at'] = now();

        DB::table('leads')->where('id', $id)->update($payload);

        return response()->json(['message' => 'Updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        if (Schema::hasTable('lead_call_logs')) {
            DB::table('lead_call_logs')->where('lead_id', $id)->delete();
        }
        if (Schema::hasTable('lead_status_history')) {
            DB::table('lead_status_history')->where('lead_id', $id)->delete();
        }
        if (Schema::hasTable('leads')) {
            DB::table('leads')->where('id', $id)->delete();
        }

        return response()->json(['message' => 'Deleted']);
    }

    public function addCallLog(Request $request, int $id): JsonResponse
    {
        if (! Schema::hasTable('lead_call_logs')) {
            return response()->json(['message' => 'lead_call_logs table not found'], 422);
        }

        $validated = $request->validate([
            'call_outcome' => ['required', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $logId = DB::table('lead_call_logs')->insertGetId([
            'lead_id' => $id,
            'called_by' => $request->user()->id,
            'call_outcome' => $validated['call_outcome'],
            'notes' => $validated['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['id' => $logId], 201);
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string'],
            'remarks' => ['nullable', 'string'],
            'next_followup_date' => ['nullable', 'date'],
        ]);

        $lead = Schema::hasTable('leads') ? DB::table('leads')->where('id', $id)->first() : null;
        if (! $lead) {
            return response()->json(['message' => 'Lead not found'], 404);
        }

        if (Schema::hasTable('lead_status_history')) {
            DB::table('lead_status_history')->insert([
                'lead_id' => $id,
                'old_status' => $lead->status,
                'new_status' => $validated['status'],
                'changed_by' => $request->user()->id,
                'remarks' => $validated['remarks'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $update = [
            'status' => $validated['status'],
            'updated_at' => now(),
        ];
        if (array_key_exists('remarks', $validated)) {
            $update['remarks'] = $validated['remarks'];
        }
        if (array_key_exists('next_followup_date', $validated)) {
            $update['next_followup_date'] = $validated['next_followup_date'];
        }

        DB::table('leads')->where('id', $id)->update($update);

        return response()->json(['message' => 'Status updated']);
    }

    public function import(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'leads' => ['required', 'array'],
        ]);

        if (! Schema::hasTable('leads')) {
            return response()->json(['message' => 'Leads table not found'], 422);
        }

        $rows = collect($validated['leads'])->map(function ($row) use ($request) {
            $payload = is_array($row) ? $row : [];
            unset($payload['id']);
            $payload['created_by'] = $request->user()->id;
            $payload['created_at'] = now();
            $payload['updated_at'] = now();

            return $payload;
        })->all();

        DB::table('leads')->insert($rows);

        return response()->json(['count' => count($rows)], 201);
    }

    public function teachers(): JsonResponse
    {
        if (! Schema::hasTable('teachers')) {
            return response()->json([]);
        }

        $rows = DB::table('teachers')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
            ->where('teachers.status', 'active')
            ->select('teachers.id', 'teachers.user_id', 'teachers.teacher_id', 'profiles.full_name')
            ->get()
            ->map(fn ($row) => [
                'id' => (string) $row->id,
                'user_id' => (string) $row->user_id,
                'teacher_id' => $row->teacher_id,
                'full_name' => $row->full_name ?: $row->teacher_id,
            ]);

        return response()->json($rows);
    }

    public function moduleStatus(): JsonResponse
    {
        if (! Schema::hasTable('app_settings')) {
            return response()->json(['enabled' => false]);
        }

        $value = DB::table('app_settings')->where('setting_key', 'leads_module_enabled')->value('setting_value');

        return response()->json(['enabled' => $this->toBool($value)]);
    }

    public function settings(): JsonResponse
    {
        $settings = Schema::hasTable('app_settings')
            ? DB::table('app_settings')
                ->whereIn('setting_key', ['leads_module_enabled', 'leads_permission_mode'])
                ->select('setting_key', 'setting_value')
                ->get()
            : collect();

        $enabledValue = $settings->firstWhere('setting_key', 'leads_module_enabled')->setting_value ?? false;
        $moduleEnabled = $this->toBool($enabledValue);

        $modeValue = $settings->firstWhere('setting_key', 'leads_permission_mode')->setting_value ?? 'all';
        $permissionMode = $modeValue === 'selected' ? 'selected' : 'all';

        $teachers = $this->teachers()->getData(true);

        $permissions = Schema::hasTable('teacher_lead_permissions')
            ? DB::table('teacher_lead_permissions')->select('teacher_id', 'enabled')->get()
            : collect();

        $teachersWithPerms = collect($teachers)->map(function ($teacher) use ($permissions) {
            $perm = $permissions->firstWhere('teacher_id', $teacher['id']);
            $teacher['enabled'] = $perm ? (bool) $perm->enabled : false;

            return $teacher;
        });

        $auditLog = Schema::hasTable('settings_audit_log')
            ? DB::table('settings_audit_log')
                ->leftJoin('profiles', 'profiles.user_id', '=', 'settings_audit_log.changed_by')
                ->select(
                    'settings_audit_log.id',
                    'settings_audit_log.setting_key',
                    'settings_audit_log.old_value',
                    'settings_audit_log.new_value',
                    'settings_audit_log.changed_by',
                    'settings_audit_log.created_at',
                    'profiles.full_name as changer_name'
                )
                ->orderByDesc('settings_audit_log.created_at')
                ->limit(20)
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->id,
                    'setting_key' => $row->setting_key,
                    'old_value' => $row->old_value,
                    'new_value' => $row->new_value,
                    'changed_by' => $row->changed_by ? (string) $row->changed_by : null,
                    'created_at' => $row->created_at,
                    'changer_name' => $row->changer_name ?: 'Unknown',
                ])
            : collect();

        return response()->json([
            'moduleEnabled' => $moduleEnabled,
            'permissionMode' => $permissionMode,
            'teachers' => $teachersWithPerms,
            'auditLog' => $auditLog,
        ]);
    }

    public function updateModule(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate(['enabled' => ['required', 'boolean']]);

        if (! Schema::hasTable('app_settings')) {
            return response()->json(['message' => 'app_settings table not found'], 422);
        }

        $old = DB::table('app_settings')->where('setting_key', 'leads_module_enabled')->value('setting_value');

        DB::table('app_settings')->updateOrInsert(
            ['setting_key' => 'leads_module_enabled'],
            ['setting_value' => $validated['enabled'] ? '1' : '0', 'updated_by' => $request->user()->id, 'updated_at' => now()]
        );

        $this->insertAudit('leads_module_enabled', $old, $validated['enabled'], $request->user()->id);

        return response()->json(['message' => 'Updated']);
    }

    public function updateMode(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate(['mode' => ['required', 'string', 'in:all,selected']]);

        if (! Schema::hasTable('app_settings')) {
            return response()->json(['message' => 'app_settings table not found'], 422);
        }

        $old = DB::table('app_settings')->where('setting_key', 'leads_permission_mode')->value('setting_value');

        DB::table('app_settings')->updateOrInsert(
            ['setting_key' => 'leads_permission_mode'],
            ['setting_value' => $validated['mode'], 'updated_by' => $request->user()->id, 'updated_at' => now()]
        );

        $this->insertAudit('leads_permission_mode', $old, $validated['mode'], $request->user()->id);

        return response()->json(['message' => 'Updated']);
    }

    public function updateTeacherPermission(Request $request, int $teacherId): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate(['enabled' => ['required', 'boolean']]);

        if (! Schema::hasTable('teacher_lead_permissions')) {
            return response()->json(['message' => 'teacher_lead_permissions table not found'], 422);
        }

        $old = DB::table('teacher_lead_permissions')->where('teacher_id', $teacherId)->value('enabled');

        DB::table('teacher_lead_permissions')->updateOrInsert(
            ['teacher_id' => $teacherId],
            ['enabled' => $validated['enabled'], 'updated_by' => $request->user()->id, 'updated_at' => now()]
        );

        $teacherName = DB::table('teachers')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'teachers.user_id')
            ->where('teachers.id', $teacherId)
            ->value('profiles.full_name') ?: (string) $teacherId;

        $this->insertAudit('teacher_lead_permission:'.$teacherName, $old, $validated['enabled'], $request->user()->id);

        return response()->json(['message' => 'Updated']);
    }

    private function insertAudit(string $key, mixed $oldValue, mixed $newValue, int $changedBy): void
    {
        if (! Schema::hasTable('settings_audit_log')) {
            return;
        }

        DB::table('settings_audit_log')->insert([
            'setting_key' => $key,
            'old_value' => $this->normalizeAuditValue($oldValue),
            'new_value' => (string) ($this->normalizeAuditValue($newValue) ?? ''),
            'changed_by' => $changedBy,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function isAdmin(Request $request): bool
    {
        return DB::table('user_roles')->where('user_id', $request->user()->id)->value('role') === 'admin';
    }

    private function toBool(mixed $value): bool
    {
        return in_array($value, [true, 1, '1', 'true', 'TRUE'], true);
    }

    private function normalizeAuditValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        return (string) $value;
    }
}
