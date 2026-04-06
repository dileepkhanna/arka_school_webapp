<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TimetableScheduleConfigController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $classId = $this->resolveClassId($request, false);

        if (Schema::hasTable('periods')) {
            $periods = $this->loadPeriodsForClass($classId);

            if ($periods->isNotEmpty()) {
                return response()->json($this->serializePeriods($periods));
            }
        }

        if (Schema::hasTable('timetable_schedule_config')) {
            $config = DB::table('timetable_schedule_config')
                ->orderBy('slot_order')
                ->get()
                ->map(fn ($row) => [
                    'id' => $row->id,
                    'classId' => 0,
                    'number' => (int) $row->period_number,
                    'startTime' => substr($row->start_time, 0, 5),
                    'endTime' => substr($row->end_time, 0, 5),
                    'isBreak' => (bool) $row->is_break,
                    'breakName' => $row->break_name ?? '',
                ]);

            if ($config->isNotEmpty()) {
                return response()->json($config);
            }
        }

        return response()->json($this->getDefaultSchedule(0));
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'class_id' => ['nullable', 'integer', 'min:0'],
            'schedule' => ['required', 'array'],
            'schedule.*.id' => ['sometimes', 'integer'],
            'schedule.*.number' => ['required', 'integer'],
            'schedule.*.startTime' => ['required', 'string', 'regex:/^\d{2}:\d{2}$/'],
            'schedule.*.endTime' => ['required', 'string', 'regex:/^\d{2}:\d{2}$/'],
            'schedule.*.isBreak' => ['required', 'boolean'],
            'schedule.*.breakName' => ['nullable', 'string', 'max:100'],
        ]);

        $classId = (int) ($validated['class_id'] ?? 0);
        $scheduleError = $this->validateScheduleTimeline($validated['schedule']);

        if ($scheduleError) {
            return response()->json([
                'message' => 'Validation failed',
                'error' => $scheduleError,
                'success' => false,
            ], 422);
        }

        DB::beginTransaction();

        try {
            if (Schema::hasTable('periods')) {
                $this->savePeriodsForClass($classId, $validated['schedule']);
                $this->ensureClassTimetableRows($classId);
                $this->syncTimetableRowsToEffectivePeriods($classId);

                DB::commit();

                return response()->json([
                    'message' => 'Schedule configuration saved successfully',
                    'success' => true,
                ]);
            }

            if (! Schema::hasTable('timetable_schedule_config')) {
                DB::rollBack();
                return response()->json(['message' => 'No schedule configuration table found'], 422);
            }

            DB::table('timetable_schedule_config')->delete();

            foreach ($validated['schedule'] as $index => $slot) {
                DB::table('timetable_schedule_config')->insert([
                    'slot_order' => $index + 1,
                    'period_number' => $slot['number'],
                    'start_time' => $slot['startTime'],
                    'end_time' => $slot['endTime'],
                    'is_break' => $slot['isBreak'],
                    'break_name' => $slot['breakName'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Schedule configuration saved successfully',
                'success' => true,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to save schedule configuration',
                'error' => $e->getMessage(),
                'success' => false,
            ], 500);
        }
    }

    public function reset(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $classId = $this->resolveClassId($request, true);

        DB::beginTransaction();

        try {
            if (Schema::hasTable('periods')) {
                if ($classId === 0) {
                    $this->savePeriodsForClass(0, $this->getDefaultSchedule(0));
                } else {
                    DB::statement('SET FOREIGN_KEY_CHECKS=0');
                    DB::table('periods')->where('class_id', $classId)->delete();
                    DB::statement('SET FOREIGN_KEY_CHECKS=1');
                }

                $this->ensureClassTimetableRows($classId);
                $this->syncTimetableRowsToEffectivePeriods($classId);

                DB::commit();

                return response()->json([
                    'message' => 'Schedule reset to default',
                    'success' => true,
                ]);
            }

            if (! Schema::hasTable('timetable_schedule_config')) {
                DB::rollBack();
                return response()->json(['message' => 'No schedule configuration table found'], 422);
            }

            DB::table('timetable_schedule_config')->delete();

            foreach ($this->getDefaultSchedule(0) as $index => $slot) {
                DB::table('timetable_schedule_config')->insert([
                    'slot_order' => $index + 1,
                    'period_number' => $slot['number'],
                    'start_time' => $slot['startTime'],
                    'end_time' => $slot['endTime'],
                    'is_break' => $slot['isBreak'],
                    'break_name' => $slot['breakName'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Schedule reset to default',
                'success' => true,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to reset schedule',
                'error' => $e->getMessage(),
                'success' => false,
            ], 500);
        }
    }

    private function resolveClassId(Request $request, bool $fromBody): int
    {
        $value = $fromBody ? $request->input('class_id', 0) : $request->query('class_id', 0);

        return max(0, (int) $value);
    }

    private function loadPeriodsForClass(int $classId): Collection
    {
        $hasClassColumn = Schema::hasColumn('periods', 'class_id');

        if (! $hasClassColumn) {
            return DB::table('periods')
                ->orderBy('start_time')
                ->orderBy('period_number')
                ->get();
        }

        $classPeriods = DB::table('periods')
            ->where('class_id', $classId)
            ->orderBy('start_time')
            ->orderBy('period_number')
            ->get();

        if ($classId !== 0 && $classPeriods->isEmpty()) {
            return DB::table('periods')
                ->where('class_id', 0)
                ->orderBy('start_time')
                ->orderBy('period_number')
                ->get();
        }

        return $classPeriods;
    }

    private function serializePeriods(Collection $periods): Collection
    {
        return $periods->map(fn ($row) => [
            'id' => $row->id,
            'classId' => isset($row->class_id) ? (int) $row->class_id : 0,
            'number' => (int) $row->period_number,
            'startTime' => substr($row->start_time, 0, 5),
            'endTime' => substr($row->end_time, 0, 5),
            'isBreak' => in_array($row->type ?? null, ['break', 'lunch'], true),
            'breakName' => in_array($row->type ?? null, ['break', 'lunch'], true) ? ($row->label ?? '') : '',
        ])->values();
    }

    private function savePeriodsForClass(int $classId, array $schedule): void
    {
        if (! Schema::hasColumn('periods', 'class_id')) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            DB::table('periods')->delete();
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        } else {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            DB::table('periods')->where('class_id', $classId)->delete();
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        foreach ($schedule as $slot) {
            $type = 'lesson';
            $label = 'Period '.$slot['number'];

            if ($slot['isBreak']) {
                $type = stripos($slot['breakName'] ?? '', 'lunch') !== false ? 'lunch' : 'break';
                $label = $slot['breakName'] ?? 'Break';
            }

            $payload = [
                'period_number' => $slot['number'],
                'label' => $label,
                'type' => $type,
                'start_time' => $slot['startTime'],
                'end_time' => $slot['endTime'],
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (Schema::hasColumn('periods', 'class_id')) {
                $payload['class_id'] = $classId;
            }

            DB::table('periods')->insert($payload);
        }
    }

    private function syncTimetableRowsToEffectivePeriods(int $classId): void
    {
        if ($classId <= 0 || ! Schema::hasTable('timetable') || ! Schema::hasTable('periods')) {
            return;
        }

        $periodMap = $this->loadPeriodsForClass($classId)
            ->keyBy(fn ($period) => (string) $period->period_number);

        if ($periodMap->isEmpty()) {
            return;
        }

        $rows = DB::table('timetable')
            ->where('class_id', $classId)
            ->get();

        foreach ($rows as $row) {
            $period = $periodMap->get((string) $row->period_number);

            if (! $period) {
                continue;
            }

            DB::table('timetable')
                ->where('id', $row->id)
                ->update([
                    'period_id' => $period->id,
                    'start_time' => $period->start_time,
                    'end_time' => $period->end_time,
                    'updated_at' => now(),
                ]);
        }
    }

    private function ensureClassTimetableRows(int $classId): void
    {
        if ($classId <= 0 || ! Schema::hasTable('timetable')) {
            return;
        }

        $hasClassRows = DB::table('timetable')->where('class_id', $classId)->exists();

        if ($hasClassRows) {
            return;
        }

        $defaultRows = DB::table('timetable')->where('class_id', 0)->get();

        if ($defaultRows->isEmpty()) {
            return;
        }

        $periodMap = $this->loadPeriodsForClass($classId)
            ->keyBy(fn ($period) => (string) $period->period_number);

        $now = now();
        $cloneRows = $defaultRows->map(function ($row) use ($classId, $periodMap, $now) {
            $period = $periodMap->get((string) $row->period_number);

            return [
                'class_id' => $classId,
                'subject_id' => $row->subject_id,
                'teacher_id' => $row->teacher_id,
                'day_of_week' => $row->day_of_week,
                'period_id' => $period->id ?? $row->period_id,
                'period_number' => $row->period_number,
                'start_time' => $period->start_time ?? $row->start_time,
                'end_time' => $period->end_time ?? $row->end_time,
                'is_published' => $row->is_published,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        })->all();

        DB::table('timetable')->insert($cloneRows);
    }

    private function validateScheduleTimeline(array $schedule): ?string
    {
        foreach ($schedule as $index => $slot) {
            $startTime = strtotime('1970-01-01 '.$slot['startTime']);
            $endTime = strtotime('1970-01-01 '.$slot['endTime']);

            if ($startTime === false || $endTime === false) {
                return 'Slot at position '.($index + 1).': Invalid time format';
            }

            if ($endTime <= $startTime) {
                return 'Slot at position '.($index + 1).': End time must be after start time';
            }

            if ($index === 0) {
                continue;
            }

            $previousEnd = strtotime('1970-01-01 '.$schedule[$index - 1]['endTime']);

            if ($startTime < $previousEnd) {
                return 'Slot at position '.($index + 1).' overlaps with the previous slot';
            }
        }

        return null;
    }

    private function getDefaultSchedule(int $classId): array
    {
        return [
            ['classId' => $classId, 'number' => 1, 'startTime' => '08:00', 'endTime' => '08:45', 'isBreak' => false, 'breakName' => ''],
            ['classId' => $classId, 'number' => 2, 'startTime' => '08:45', 'endTime' => '09:30', 'isBreak' => false, 'breakName' => ''],
            ['classId' => $classId, 'number' => 0, 'startTime' => '09:30', 'endTime' => '09:45', 'isBreak' => true, 'breakName' => 'Short Break'],
            ['classId' => $classId, 'number' => 3, 'startTime' => '09:45', 'endTime' => '10:30', 'isBreak' => false, 'breakName' => ''],
            ['classId' => $classId, 'number' => 4, 'startTime' => '10:30', 'endTime' => '11:15', 'isBreak' => false, 'breakName' => ''],
            ['classId' => $classId, 'number' => 0, 'startTime' => '11:15', 'endTime' => '11:30', 'isBreak' => true, 'breakName' => 'Short Break'],
            ['classId' => $classId, 'number' => 5, 'startTime' => '11:30', 'endTime' => '12:15', 'isBreak' => false, 'breakName' => ''],
            ['classId' => $classId, 'number' => 6, 'startTime' => '12:15', 'endTime' => '13:00', 'isBreak' => false, 'breakName' => ''],
            ['classId' => $classId, 'number' => 0, 'startTime' => '13:00', 'endTime' => '14:00', 'isBreak' => true, 'breakName' => 'Lunch Break'],
            ['classId' => $classId, 'number' => 7, 'startTime' => '14:00', 'endTime' => '14:45', 'isBreak' => false, 'breakName' => ''],
            ['classId' => $classId, 'number' => 8, 'startTime' => '14:45', 'endTime' => '15:30', 'isBreak' => false, 'breakName' => ''],
        ];
    }

    private function isAdmin(Request $request): bool
    {
        return DB::table('user_roles')->where('user_id', $request->user()->id)->value('role') === 'admin';
    }
}
