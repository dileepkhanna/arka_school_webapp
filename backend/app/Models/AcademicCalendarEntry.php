<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AcademicCalendarEntry extends Model
{
    use HasFactory;

    public const CATEGORY_HOLIDAY = 'holiday';
    public const CATEGORY_EVENT = 'event';
    public const CATEGORY_ACADEMIC_ACTIVITY = 'academic_activity';
    public const CATEGORY_MEETING = 'meeting';
    public const CATEGORY_IMPORTANT_DATE = 'important_date';

    public const AUDIENCE_ALL = 'all';
    public const AUDIENCE_ROLES = 'roles';
    public const AUDIENCE_CLASSES = 'classes';
    public const AUDIENCE_USERS = 'users';

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PUBLISHED = 'published';
    public const STATUS_CANCELLED = 'cancelled';

    public const ROLES = ['admin', 'teacher', 'parent'];
    public const ALLOWED_NOTIFY_OFFSETS = [1, 2, 3];

    protected $table = 'academic_calendar_entries';

    protected $fillable = [
        'title',
        'category',
        'subcategory',
        'start_date',
        'end_date',
        'all_day',
        'start_time',
        'end_time',
        'description',
        'image_url',
        'location',
        'is_recurring',
        'recurrence_rule',
        'audience_type',
        'audience_roles',
        'audience_class_ids',
        'audience_user_ids',
        'notify_enabled',
        'notify_offsets_days',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'all_day' => 'boolean',
        'is_recurring' => 'boolean',
        'notify_enabled' => 'boolean',
        'audience_roles' => 'array',
        'audience_class_ids' => 'array',
        'audience_user_ids' => 'array',
        'notify_offsets_days' => 'array',
    ];

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PUBLISHED);
    }

    public function scopeVisibleToUser(Builder $query, int $userId, ?string $role): Builder
    {
        if ($role === 'admin') {
            return $query;
        }

        $classIds = self::resolveClassIdsForUser($userId, $role);

        return $query->where(function (Builder $inner) use ($role, $classIds, $userId): void {
            $inner->where('audience_type', self::AUDIENCE_ALL);

            if (is_string($role) && $role !== '') {
                $inner->orWhere(function (Builder $rolesQuery) use ($role): void {
                    $rolesQuery
                        ->where('audience_type', self::AUDIENCE_ROLES)
                        ->whereJsonContains('audience_roles', $role);
                });
            }

            if (! empty($classIds)) {
                $inner->orWhere(function (Builder $classQuery) use ($classIds): void {
                    $classQuery
                        ->where('audience_type', self::AUDIENCE_CLASSES)
                        ->where(function (Builder $jsonQuery) use ($classIds): void {
                            foreach ($classIds as $index => $classId) {
                                if ($index === 0) {
                                    $jsonQuery->whereJsonContains('audience_class_ids', (int) $classId);
                                } else {
                                    $jsonQuery->orWhereJsonContains('audience_class_ids', (int) $classId);
                                }
                            }
                        });
                });
            }

            $inner->orWhere(function (Builder $usersQuery) use ($userId): void {
                $usersQuery
                    ->where('audience_type', self::AUDIENCE_USERS)
                    ->whereJsonContains('audience_user_ids', $userId);
            });
        });
    }

    public static function roleForUserId(int $userId): ?string
    {
        if (! Schema::hasTable('user_roles')) {
            return null;
        }

        $role = DB::table('user_roles')->where('user_id', $userId)->value('role');

        return is_string($role) ? $role : null;
    }

    public static function resolveClassIdsForUser(int $userId, ?string $role): array
    {
        if ($role === 'teacher' && Schema::hasTable('teachers') && Schema::hasTable('teacher_classes')) {
            $teacherId = DB::table('teachers')->where('user_id', $userId)->value('id');

            if ($teacherId) {
                return DB::table('teacher_classes')
                    ->where('teacher_id', $teacherId)
                    ->pluck('class_id')
                    ->map(fn ($value) => (int) $value)
                    ->all();
            }
        }

        if ($role === 'parent' && Schema::hasTable('parents') && Schema::hasTable('student_parents') && Schema::hasTable('students')) {
            $parentId = DB::table('parents')->where('user_id', $userId)->value('id');

            if ($parentId) {
                return DB::table('student_parents')
                    ->join('students', 'students.id', '=', 'student_parents.student_id')
                    ->where('student_parents.parent_id', $parentId)
                    ->whereNotNull('students.class_id')
                    ->pluck('students.class_id')
                    ->map(fn ($value) => (int) $value)
                    ->unique()
                    ->values()
                    ->all();
            }
        }

        return [];
    }

    public function audienceUserIds(): array
    {
        if (! Schema::hasTable('user_roles')) {
            return [];
        }

        return match ($this->audience_type) {
            self::AUDIENCE_ROLES => $this->usersForRoles($this->audience_roles ?? []),
            self::AUDIENCE_CLASSES => $this->usersForClasses($this->audience_class_ids ?? []),
            self::AUDIENCE_USERS => $this->usersForExplicitIds($this->audience_user_ids ?? []),
            default => $this->usersForRoles(self::ROLES),
        };
    }

    public function normalizedNotifyOffsets(): array
    {
        return collect($this->notify_offsets_days ?? [])
            ->filter(fn ($value) => is_numeric($value))
            ->map(fn ($value) => (int) $value)
            ->filter(fn (int $value) => in_array($value, self::ALLOWED_NOTIFY_OFFSETS, true))
            ->unique()
            ->sortDesc()
            ->values()
            ->all();
    }

    public function occurrenceForYear(int $year): array
    {
        $start = $this->projectDateToYear($this->start_date, $year);
        $end = $this->end_date ? $this->projectDateToYear($this->end_date, $year) : null;

        return [$start, $end];
    }

    public function nextOccurrenceFrom(Carbon $referenceDate): array
    {
        $year = $referenceDate->year;
        [$start, $end] = $this->occurrenceForYear($year);

        if ($start->lt($referenceDate->copy()->startOfDay())) {
            [$start, $end] = $this->occurrenceForYear($year + 1);
        }

        return [$start, $end];
    }

    private function usersForRoles(array $roles): array
    {
        $roles = collect($roles)
            ->filter(fn ($role) => is_string($role) && in_array($role, self::ROLES, true))
            ->values()
            ->all();

        if (empty($roles)) {
            return [];
        }

        return DB::table('user_roles')
            ->whereIn('role', $roles)
            ->pluck('user_id')
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values()
            ->all();
    }

    private function usersForClasses(array $classIds): array
    {
        $classIds = collect($classIds)
            ->filter(fn ($value) => is_numeric($value))
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values()
            ->all();

        if (empty($classIds)) {
            return [];
        }

        $teacherUserIds = collect();
        if (Schema::hasTable('teacher_classes') && Schema::hasTable('teachers')) {
            $teacherUserIds = DB::table('teacher_classes')
                ->join('teachers', 'teachers.id', '=', 'teacher_classes.teacher_id')
                ->whereIn('teacher_classes.class_id', $classIds)
                ->whereNotNull('teachers.user_id')
                ->pluck('teachers.user_id');
        }

        $parentUserIds = collect();
        if (Schema::hasTable('student_parents') && Schema::hasTable('students') && Schema::hasTable('parents')) {
            $parentUserIds = DB::table('student_parents')
                ->join('students', 'students.id', '=', 'student_parents.student_id')
                ->join('parents', 'parents.id', '=', 'student_parents.parent_id')
                ->whereIn('students.class_id', $classIds)
                ->whereNotNull('parents.user_id')
                ->pluck('parents.user_id');
        }

        return $teacherUserIds
            ->concat($parentUserIds)
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values()
            ->all();
    }

    private function usersForExplicitIds(array $userIds): array
    {
        return collect($userIds)
            ->filter(fn ($value) => is_numeric($value))
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values()
            ->all();
    }

    private function projectDateToYear(mixed $value, int $year): Carbon
    {
        $source = $value instanceof Carbon ? $value : Carbon::parse((string) $value);
        $month = (int) $source->format('m');
        $day = min((int) $source->format('d'), Carbon::create($year, $month, 1)->endOfMonth()->day);

        return Carbon::create($year, $month, $day)->startOfDay();
    }
}
