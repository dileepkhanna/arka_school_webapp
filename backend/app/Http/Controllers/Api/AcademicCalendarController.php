<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicCalendarEntry;
use App\Support\HandlesUploadStorage;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AcademicCalendarController extends Controller
{
    use HandlesUploadStorage;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'year' => ['nullable', 'regex:/^\d{4}$/'],
            'category' => ['nullable', 'string', 'in:'.implode(',', $this->categories())],
            'status' => ['nullable', 'string', 'in:draft,published,cancelled'],
        ]);

        $year = isset($validated['year']) ? (int) $validated['year'] : now()->year;
        $role = AcademicCalendarEntry::roleForUserId((int) $request->user()->id);
        $legacyMode = $this->isLegacyHolidayRequest($request);

        $query = AcademicCalendarEntry::query();

        if ($legacyMode) {
            $query->where('category', AcademicCalendarEntry::CATEGORY_HOLIDAY);
        } elseif (! empty($validated['category'])) {
            $query->where('category', $validated['category']);
        }

        if ($role !== 'admin') {
            $query->published()->visibleToUser((int) $request->user()->id, $role);
        } elseif (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $entries = $query
            ->get()
            ->flatMap(fn (AcademicCalendarEntry $entry) => $this->projectEntryForYear($entry, $year))
            ->sortBy('start_date')
            ->values();

        if ($legacyMode) {
            return response()->json($entries->map(fn (array $entry) => $this->toLegacyHolidayPayload($entry))->values());
        }

        return response()->json($entries);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $this->validatePayload($request, false);
        $imageUrl = $this->storeOrReuseImage($request, null);

        $entry = AcademicCalendarEntry::create([
            ...$validated,
            'image_url' => $imageUrl,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json($entry->fresh(), 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $entry = AcademicCalendarEntry::find($id);
        if (! $entry) {
            return response()->json(['message' => 'Not Found'], 404);
        }

        $role = AcademicCalendarEntry::roleForUserId((int) $request->user()->id);
        if ($role !== 'admin') {
            $visible = AcademicCalendarEntry::query()
                ->whereKey($entry->id)
                ->published()
                ->visibleToUser((int) $request->user()->id, $role)
                ->exists();

            if (! $visible) {
                return response()->json(['message' => 'Not Found'], 404);
            }
        }

        return response()->json($this->serializedEntry(
            $entry,
            $entry->id,
            Carbon::parse($entry->start_date)->toDateString(),
            $entry->end_date ? Carbon::parse($entry->end_date)->toDateString() : null,
        ));
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $entry = AcademicCalendarEntry::find($id);
        if (! $entry) {
            return response()->json(['message' => 'Not Found'], 404);
        }

        $validated = $this->validatePayload($request, true);
        $imageUrl = $this->storeOrReuseImage($request, $entry->image_url);

        $entry->fill([
            ...$validated,
            'image_url' => $imageUrl,
            'updated_by' => $request->user()->id,
        ]);
        $entry->save();

        return response()->json($entry->fresh());
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $entry = AcademicCalendarEntry::find($id);
        if (! $entry) {
            return response()->json(['message' => 'Not Found'], 404);
        }

        if ($entry->image_url) {
            $this->deleteStoredFile($entry->image_url);
        }

        $entry->delete();

        return response()->json(['message' => 'Deleted']);
    }

    public function audienceUsers(Request $request): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'role' => ['nullable', 'string', 'in:admin,teacher,parent'],
            'search' => ['nullable', 'string', 'max:100'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'ids' => ['nullable', 'array'],
            'ids.*' => ['integer'],
        ]);

        $limit = (int) ($validated['limit'] ?? 25);
        $search = trim((string) ($validated['search'] ?? ''));

        $query = DB::table('users')
            ->join('user_roles', 'user_roles.user_id', '=', 'users.id')
            ->leftJoin('profiles', 'profiles.user_id', '=', 'users.id')
            ->select(
                'users.id',
                'users.email',
                'user_roles.role',
                DB::raw("COALESCE(profiles.full_name, users.name) as full_name")
            );

        if (! empty($validated['role'])) {
            $query->where('user_roles.role', $validated['role']);
        }

        if (! empty($validated['ids'])) {
            $query->whereIn('users.id', $validated['ids']);
        }

        if ($search !== '') {
            $query->where(function ($inner) use ($search): void {
                $inner->where('profiles.full_name', 'like', '%'.$search.'%')
                    ->orWhere('users.name', 'like', '%'.$search.'%')
                    ->orWhere('users.email', 'like', '%'.$search.'%');
            });
        }

        $users = $query
            ->orderBy('full_name')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'full_name' => (string) $row->full_name,
                'email' => $row->email,
                'role' => (string) $row->role,
            ])
            ->values();

        return response()->json($users);
    }

    private function validatePayload(Request $request, bool $isUpdate): array
    {
        $legacyMode = $this->isLegacyHolidayRequest($request);
        $request->merge($this->normalizedInput($request, $legacyMode));

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'in:'.implode(',', $this->categories())],
            'subcategory' => ['nullable', 'string', 'max:255'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'all_day' => ['required', 'boolean'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i', 'after:start_time'],
            'description' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:255'],
            'is_recurring' => ['nullable', 'boolean'],
            'recurrence_rule' => ['nullable', 'string', 'max:255'],
            'audience_type' => ['required', 'string', 'in:all,roles,classes,users'],
            'audience_roles' => ['nullable', 'array'],
            'audience_roles.*' => ['string', 'in:admin,teacher,parent'],
            'audience_class_ids' => ['nullable', 'array'],
            'audience_class_ids.*' => ['integer'],
            'audience_user_ids' => ['nullable', 'array'],
            'audience_user_ids.*' => ['integer'],
            'notify_enabled' => ['required', 'boolean'],
            'notify_offsets_days' => ['nullable', 'array'],
            'notify_offsets_days.*' => ['integer', 'in:1,2,3'],
            'status' => ['required', 'string', 'in:draft,published,cancelled'],
            'image' => [$isUpdate ? 'nullable' : 'sometimes', 'image', 'max:10240'],
        ]);

        if (! $validated['all_day'] && (empty($validated['start_time']) || empty($validated['end_time']))) {
            throw ValidationException::withMessages([
                'start_time' => ['Start time is required for timed entries.'],
                'end_time' => ['End time is required for timed entries.'],
            ]);
        }

        if ($validated['audience_type'] === AcademicCalendarEntry::AUDIENCE_ROLES && empty($validated['audience_roles'])) {
            throw ValidationException::withMessages([
                'audience_roles' => ['Select at least one role.'],
            ]);
        }

        if ($validated['audience_type'] === AcademicCalendarEntry::AUDIENCE_CLASSES && empty($validated['audience_class_ids'])) {
            throw ValidationException::withMessages([
                'audience_class_ids' => ['Select at least one class.'],
            ]);
        }

        if ($validated['audience_type'] === AcademicCalendarEntry::AUDIENCE_USERS && empty($validated['audience_user_ids'])) {
            throw ValidationException::withMessages([
                'audience_user_ids' => ['Select at least one user.'],
            ]);
        }

        if ($validated['notify_enabled']) {
            $offsets = collect($validated['notify_offsets_days'] ?? [])
                ->map(fn ($value) => (int) $value)
                ->unique()
                ->sortDesc()
                ->values()
                ->all();

            if (empty($offsets)) {
                $offsets = [3, 2, 1];
            }

            $validated['notify_offsets_days'] = $offsets;
        } else {
            $validated['notify_offsets_days'] = [];
        }

        if ($validated['all_day']) {
            $validated['start_time'] = null;
            $validated['end_time'] = null;
        }

        return $validated;
    }

    private function normalizedInput(Request $request, bool $legacyMode): array
    {
        $category = $request->input('category');
        $subcategory = $request->input('subcategory');

        if ($legacyMode) {
            $category = AcademicCalendarEntry::CATEGORY_HOLIDAY;
            $subcategory = $request->input('type', $subcategory);
        }

        return [
            'title' => $request->input('title', $request->input('name')),
            'category' => $category,
            'subcategory' => $subcategory,
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date') ?: null,
            'all_day' => $this->toBoolean($request->input('all_day', true)),
            'start_time' => $request->input('start_time') ?: null,
            'end_time' => $request->input('end_time') ?: null,
            'description' => $request->input('description') ?: null,
            'location' => $request->input('location') ?: null,
            'is_recurring' => $this->toBoolean($request->input('is_recurring', false)),
            'recurrence_rule' => $request->input('recurrence_rule') ?: null,
            'audience_type' => $request->input('audience_type', 'all'),
            'audience_roles' => $this->parseArrayInput($request->input('audience_roles')),
            'audience_class_ids' => $this->parseArrayInput($request->input('audience_class_ids')),
            'audience_user_ids' => $this->parseArrayInput($request->input('audience_user_ids')),
            'notify_enabled' => $this->toBoolean($request->input('notify_enabled', true)),
            'notify_offsets_days' => $this->parseArrayInput($request->input('notify_offsets_days', [3, 2, 1])),
            'status' => $request->input('status', 'published'),
        ];
    }

    private function parseArrayInput(mixed $value): array
    {
        if (is_array($value)) {
            return array_values($value);
        }

        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);

            if (is_array($decoded)) {
                return array_values($decoded);
            }

            return array_values(array_filter(array_map('trim', explode(',', $value)), fn ($item) => $item !== ''));
        }

        return [];
    }

    private function storeOrReuseImage(Request $request, ?string $existingUrl): ?string
    {
        if (! $request->hasFile('image')) {
            return $existingUrl;
        }

        if ($existingUrl) {
            $this->deleteStoredFile($existingUrl);
        }

        $path = $this->storeUploadedFile($request->file('image'), 'academic-calendar');

        return $this->buildUploadUrl($path);
    }

    private function projectEntryForYear(AcademicCalendarEntry $entry, int $year): array
    {
        if (! $entry->is_recurring) {
            $startDate = Carbon::parse($entry->start_date)->toDateString();
            $endDate = $entry->end_date ? Carbon::parse($entry->end_date)->toDateString() : null;

            if (! $this->overlapsYear($startDate, $endDate, $year)) {
                return [];
            }

            return [$this->serializedEntry($entry, $entry->id, $startDate, $endDate)];
        }

        [$start, $end] = $entry->occurrenceForYear($year);

        return [$this->serializedEntry($entry, 'recurring_'.$entry->id.'_'.$year, $start->toDateString(), $end?->toDateString())];
    }

    private function serializedEntry(AcademicCalendarEntry $entry, int|string $id, string $startDate, ?string $endDate): array
    {
        return [
            'id' => $id,
            'entry_id' => $entry->id,
            'title' => $entry->title,
            'category' => $entry->category,
            'subcategory' => $entry->subcategory,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'all_day' => (bool) $entry->all_day,
            'start_time' => $entry->start_time,
            'end_time' => $entry->end_time,
            'description' => $entry->description,
            'image_url' => $entry->image_url,
            'location' => $entry->location,
            'is_recurring' => (bool) $entry->is_recurring,
            'recurrence_rule' => $entry->recurrence_rule,
            'audience_type' => $entry->audience_type,
            'audience_roles' => $entry->audience_roles ?? [],
            'audience_class_ids' => $entry->audience_class_ids ?? [],
            'audience_user_ids' => $entry->audience_user_ids ?? [],
            'notify_enabled' => (bool) $entry->notify_enabled,
            'notify_offsets_days' => $entry->normalizedNotifyOffsets(),
            'status' => $entry->status,
            'created_by' => $entry->created_by,
            'updated_by' => $entry->updated_by,
            'created_at' => $entry->created_at?->toISOString(),
            'updated_at' => $entry->updated_at?->toISOString(),
        ];
    }

    private function toLegacyHolidayPayload(array $entry): array
    {
        return [
            'id' => $entry['id'],
            'name' => $entry['title'],
            'type' => $entry['subcategory'] ?: 'school',
            'start_date' => $entry['start_date'],
            'end_date' => $entry['end_date'],
            'description' => $entry['description'],
            'image_url' => $entry['image_url'],
            'is_recurring' => $entry['is_recurring'],
            'created_at' => $entry['created_at'],
        ];
    }

    private function overlapsYear(string $startDate, ?string $endDate, int $year): bool
    {
        $yearStart = Carbon::create($year, 1, 1)->toDateString();
        $yearEnd = Carbon::create($year, 12, 31)->toDateString();

        if ($endDate) {
            return $startDate <= $yearEnd && $endDate >= $yearStart;
        }

        return $startDate >= $yearStart && $startDate <= $yearEnd;
    }

    private function categories(): array
    {
        return [
            AcademicCalendarEntry::CATEGORY_HOLIDAY,
            AcademicCalendarEntry::CATEGORY_EVENT,
            AcademicCalendarEntry::CATEGORY_ACADEMIC_ACTIVITY,
            AcademicCalendarEntry::CATEGORY_MEETING,
            AcademicCalendarEntry::CATEGORY_IMPORTANT_DATE,
        ];
    }

    private function isAdmin(Request $request): bool
    {
        return AcademicCalendarEntry::roleForUserId((int) $request->user()->id) === 'admin';
    }

    private function isLegacyHolidayRequest(Request $request): bool
    {
        return str_starts_with(trim($request->path(), '/'), 'holidays');
    }

    private function toBoolean(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        return in_array($value, [1, '1', 'true', 'on', 'yes'], true);
    }
}
