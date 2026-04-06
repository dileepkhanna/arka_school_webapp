<?php

namespace Tests\Feature;

use App\Models\AcademicCalendarEntry;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AcademicCalendarTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        try {
            DB::connection()->getPdo();
        } catch (\Throwable $e) {
            $this->markTestSkipped('Database unavailable for academic calendar tests: '.$e->getMessage());
        }

        $this->ensureMinimumSchema();
    }

    public function test_admin_can_crud_academic_calendar_entry(): void
    {
        $adminToken = $this->createUserWithRole('admin');

        $createResponse = $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->postJson('/academic-calendar', [
            'title' => 'Board Review Meeting',
            'category' => 'meeting',
            'subcategory' => 'governance',
            'start_date' => '2026-08-21',
            'end_date' => '2026-08-21',
            'all_day' => false,
            'start_time' => '10:00',
            'end_time' => '11:30',
            'description' => 'Quarterly board review',
            'location' => 'Conference Room',
            'is_recurring' => false,
            'audience_type' => 'roles',
            'audience_roles' => ['admin'],
            'notify_enabled' => true,
            'notify_offsets_days' => [3, 1],
            'status' => 'published',
        ]);

        $createResponse->assertCreated()
            ->assertJsonPath('title', 'Board Review Meeting')
            ->assertJsonPath('category', 'meeting');

        $entryId = (int) $createResponse->json('id');

        $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->getJson('/academic-calendar/'.$entryId)
            ->assertOk()
            ->assertJsonPath('id', $entryId)
            ->assertJsonPath('audience_roles.0', 'admin');

        $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->putJson('/academic-calendar/'.$entryId, [
            'title' => 'Board Review Meeting Updated',
            'category' => 'meeting',
            'subcategory' => 'governance',
            'start_date' => '2026-08-21',
            'end_date' => '2026-08-21',
            'all_day' => true,
            'description' => 'Updated agenda',
            'location' => 'Main Office',
            'is_recurring' => false,
            'audience_type' => 'users',
            'audience_user_ids' => [$this->tokenOwnerId($adminToken)],
            'notify_enabled' => false,
            'status' => 'draft',
        ])->assertOk()
            ->assertJsonPath('title', 'Board Review Meeting Updated')
            ->assertJsonPath('status', 'draft');

        $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->deleteJson('/academic-calendar/'.$entryId)
            ->assertOk();

        $this->assertDatabaseMissing('academic_calendar_entries', [
            'id' => $entryId,
        ]);
    }

    public function test_visibility_respects_roles_classes_and_specific_users(): void
    {
        $adminToken = $this->createUserWithRole('admin');
        $teacherToken = $this->createUserWithRole('teacher');
        $teacherUserId = $this->tokenOwnerId($teacherToken);
        $teacherId = (int) DB::table('teachers')->where('user_id', $teacherUserId)->value('id');

        $parentToken = $this->createUserWithRole('parent');
        $parentUserId = $this->tokenOwnerId($parentToken);
        $parentId = (int) DB::table('parents')->where('user_id', $parentUserId)->value('id');

        $outsiderToken = $this->createUserWithRole('teacher');
        $outsiderUserId = $this->tokenOwnerId($outsiderToken);

        $classId = DB::table('classes')->insertGetId([
            'name' => '10',
            'section' => 'A'.substr(bin2hex(random_bytes(3)), 0, 4),
            'academic_year' => '2026-2027',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('teacher_classes')->insert([
            'teacher_id' => $teacherId,
            'class_id' => $classId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $studentId = DB::table('students')->insertGetId([
            'admission_number' => 'ADM'.strtoupper(substr(bin2hex(random_bytes(5)), 0, 8)),
            'full_name' => 'Student '.substr(bin2hex(random_bytes(4)), 0, 6),
            'class_id' => $classId,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('student_parents')->insert([
            'student_id' => $studentId,
            'parent_id' => $parentId,
            'relationship' => 'parent',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        AcademicCalendarEntry::create([
            'title' => 'Teachers Only Session',
            'category' => 'meeting',
            'start_date' => '2026-09-10',
            'all_day' => true,
            'audience_type' => 'roles',
            'audience_roles' => ['teacher'],
            'notify_enabled' => false,
            'notify_offsets_days' => [],
            'status' => 'published',
            'created_by' => $this->tokenOwnerId($adminToken),
            'updated_by' => $this->tokenOwnerId($adminToken),
        ]);

        AcademicCalendarEntry::create([
            'title' => 'Class 10A Orientation',
            'category' => 'academic_activity',
            'start_date' => '2026-09-11',
            'all_day' => true,
            'audience_type' => 'classes',
            'audience_class_ids' => [$classId],
            'notify_enabled' => false,
            'notify_offsets_days' => [],
            'status' => 'published',
            'created_by' => $this->tokenOwnerId($adminToken),
            'updated_by' => $this->tokenOwnerId($adminToken),
        ]);

        AcademicCalendarEntry::create([
            'title' => 'Private Parent Note',
            'category' => 'important_date',
            'start_date' => '2026-09-12',
            'all_day' => true,
            'audience_type' => 'users',
            'audience_user_ids' => [$parentUserId],
            'notify_enabled' => false,
            'notify_offsets_days' => [],
            'status' => 'published',
            'created_by' => $this->tokenOwnerId($adminToken),
            'updated_by' => $this->tokenOwnerId($adminToken),
        ]);

        $teacherTitles = collect($this->withHeaders([
            'Authorization' => 'Bearer '.$teacherToken,
        ])->getJson('/academic-calendar?year=2026')->assertOk()->json())
            ->pluck('title')
            ->all();

        $parentTitles = collect($this->withHeaders([
            'Authorization' => 'Bearer '.$parentToken,
        ])->getJson('/academic-calendar?year=2026')->assertOk()->json())
            ->pluck('title')
            ->all();

        $outsiderTitles = collect($this->withHeaders([
            'Authorization' => 'Bearer '.$outsiderToken,
        ])->getJson('/academic-calendar?year=2026')->assertOk()->json())
            ->pluck('title')
            ->all();

        $this->assertContains('Teachers Only Session', $teacherTitles);
        $this->assertContains('Class 10A Orientation', $teacherTitles);
        $this->assertNotContains('Private Parent Note', $teacherTitles);

        $this->assertContains('Class 10A Orientation', $parentTitles);
        $this->assertContains('Private Parent Note', $parentTitles);
        $this->assertNotContains('Teachers Only Session', $parentTitles);

        $this->assertContains('Teachers Only Session', $outsiderTitles);
        $this->assertNotContains('Class 10A Orientation', $outsiderTitles);
        $this->assertNotContains('Private Parent Note', $outsiderTitles);

        $this->assertSame(404, $this->withHeaders([
            'Authorization' => 'Bearer '.$outsiderToken,
        ])->getJson('/academic-calendar/'.AcademicCalendarEntry::where('title', 'Private Parent Note')->value('id'))->status());

        $selectorUsers = $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->getJson('/academic-calendar/audience-users?role=teacher&search=User')->assertOk()->json();

        $this->assertNotEmpty($selectorUsers);
    }

    public function test_recurring_entries_project_to_requested_year(): void
    {
        $adminToken = $this->createUserWithRole('admin');

        AcademicCalendarEntry::create([
            'title' => 'Founders Day',
            'category' => 'holiday',
            'start_date' => '2024-12-25',
            'end_date' => '2024-12-26',
            'all_day' => true,
            'is_recurring' => true,
            'audience_type' => 'all',
            'notify_enabled' => true,
            'notify_offsets_days' => [3, 1],
            'status' => 'published',
            'created_by' => $this->tokenOwnerId($adminToken),
            'updated_by' => $this->tokenOwnerId($adminToken),
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->getJson('/academic-calendar?year=2027');

        $response->assertOk();
        $entry = collect($response->json())->firstWhere('title', 'Founders Day');

        $this->assertNotNull($entry);
        $this->assertSame('2027-12-25', $entry['start_date']);
        $this->assertSame('2027-12-26', $entry['end_date']);
        $this->assertSame('recurring_'.AcademicCalendarEntry::where('title', 'Founders Day')->value('id').'_2027', $entry['id']);
    }

    public function test_reminders_are_deduplicated_per_user_and_offset(): void
    {
        $teacherToken = $this->createUserWithRole('teacher');
        $teacherUserId = $this->tokenOwnerId($teacherToken);

        $service = app(NotificationService::class);
        $service->notifyUsers([$teacherUserId], 'Upcoming Event: Science Fair', 'Science Fair starts in 3 days on 2026-06-10.', [
            'type' => 'academic_calendar',
            'priority' => 'normal',
            'entity_type' => 'academic_calendar',
            'entity_id' => '999',
            'channel' => 'both',
            'dedupe_key' => 'academic-calendar:999:3:'.$teacherUserId,
            'link' => '/teacher/academic-calendar',
            'meta' => ['days_before' => 3],
        ]);
        $service->notifyUsers([$teacherUserId], 'Upcoming Event: Science Fair', 'Science Fair starts in 3 days on 2026-06-10.', [
            'type' => 'academic_calendar',
            'priority' => 'normal',
            'entity_type' => 'academic_calendar',
            'entity_id' => '999',
            'channel' => 'both',
            'dedupe_key' => 'academic-calendar:999:3:'.$teacherUserId,
            'link' => '/teacher/academic-calendar',
            'meta' => ['days_before' => 3],
        ]);

        $this->assertSame(1, DB::table('notifications')
            ->where('user_id', $teacherUserId)
            ->where('entity_id', '999')
            ->count());
    }

    private function createUserWithRole(string $role): string
    {
        $plainToken = 'tok_'.bin2hex(random_bytes(16));
        $userId = DB::table('users')->insertGetId([
            'name' => 'U '.substr(bin2hex(random_bytes(5)), 0, 6),
            'email' => 'u_'.bin2hex(random_bytes(6)).'@test.local',
            'password' => Hash::make('password123'),
            'api_token' => hash('sha256', $plainToken),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('profiles')->insert([
            'user_id' => $userId,
            'full_name' => 'User '.$userId,
            'email' => 'u'.$userId.'@test.local',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('user_roles')->insert([
            'user_id' => $userId,
            'role' => $role,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($role === 'teacher') {
            DB::table('teachers')->insert([
                'user_id' => $userId,
                'teacher_id' => 'TCH'.strtoupper(substr(bin2hex(random_bytes(5)), 0, 8)),
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($role === 'parent') {
            DB::table('parents')->insert([
                'user_id' => $userId,
                'phone' => '9999999999',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $plainToken;
    }

    private function tokenOwnerId(string $plainToken): int
    {
        return (int) DB::table('users')->where('api_token', hash('sha256', $plainToken))->value('id');
    }

    private function ensureMinimumSchema(): void
    {
        if (! Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->string('email')->unique();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('password');
                $table->rememberToken()->nullable();
                $table->string('api_token', 80)->nullable()->unique();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('profiles')) {
            Schema::create('profiles', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->unique();
                $table->string('full_name');
                $table->string('email')->nullable();
                $table->string('phone')->nullable();
                $table->string('photo_url')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('user_roles')) {
            Schema::create('user_roles', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->unique();
                $table->string('role');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('teachers')) {
            Schema::create('teachers', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable()->unique();
                $table->string('teacher_id')->unique();
                $table->text('subjects')->nullable();
                $table->string('qualification')->nullable();
                $table->string('status')->default('active');
                $table->date('joining_date')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('parents')) {
            Schema::create('parents', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->unique();
                $table->string('phone')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('classes')) {
            Schema::create('classes', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->string('section');
                $table->unsignedBigInteger('class_teacher_id')->nullable();
                $table->string('academic_year')->default('2026-2027');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('students')) {
            Schema::create('students', function (Blueprint $table): void {
                $table->id();
                $table->string('admission_number')->unique();
                $table->string('full_name');
                $table->unsignedBigInteger('class_id')->nullable();
                $table->unsignedBigInteger('user_id')->nullable()->unique();
                $table->string('status')->default('active');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('student_parents')) {
            Schema::create('student_parents', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('student_id');
                $table->unsignedBigInteger('parent_id');
                $table->string('relationship')->default('parent');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('teacher_classes')) {
            Schema::create('teacher_classes', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('teacher_id');
                $table->unsignedBigInteger('class_id');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('academic_calendar_entries')) {
            Schema::create('academic_calendar_entries', function (Blueprint $table): void {
                $table->id();
                $table->string('title');
                $table->string('category')->default('holiday');
                $table->string('subcategory')->nullable();
                $table->date('start_date');
                $table->date('end_date')->nullable();
                $table->boolean('all_day')->default(true);
                $table->time('start_time')->nullable();
                $table->time('end_time')->nullable();
                $table->text('description')->nullable();
                $table->string('image_url')->nullable();
                $table->string('location')->nullable();
                $table->boolean('is_recurring')->default(false);
                $table->string('recurrence_rule')->nullable();
                $table->string('audience_type')->default('all');
                $table->json('audience_roles')->nullable();
                $table->json('audience_class_ids')->nullable();
                $table->json('audience_user_ids')->nullable();
                $table->boolean('notify_enabled')->default(true);
                $table->json('notify_offsets_days')->nullable();
                $table->string('status')->default('published');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->string('title');
                $table->text('message');
                $table->string('type')->default('general');
                $table->string('link')->nullable();
                $table->boolean('is_read')->default(false);
                $table->string('entity_type')->nullable();
                $table->string('entity_id')->nullable();
                $table->string('priority')->nullable();
                $table->string('channel')->nullable();
                $table->string('dedupe_key')->nullable();
                $table->longText('meta_json')->nullable();
                $table->timestamps();
            });
        }
    }
}
