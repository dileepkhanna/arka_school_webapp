<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class StudentRecordClassHistoryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        try {
            DB::connection()->getPdo();
        } catch (\Throwable $e) {
            $this->markTestSkipped('Database unavailable: '.$e->getMessage());
        }

        $this->ensureMinimumSchema();
    }

    public function test_student_history_keeps_original_exam_and_attendance_class_after_promotion(): void
    {
        $adminToken = $this->createUserWithRole('admin');
        $teacherToken = $this->createUserWithRole('teacher');
        $teacherUserId = $this->tokenOwnerId($teacherToken);
        $teacherId = (int) DB::table('teachers')->where('user_id', $teacherUserId)->value('id');

        $classEightId = DB::table('classes')->insertGetId([
            'name' => '8',
            'section' => 'A',
            'academic_year' => '2025-2026',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $classNineId = DB::table('classes')->insertGetId([
            'name' => '9',
            'section' => 'A',
            'academic_year' => '2026-2027',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('teacher_classes')->insert([
            'teacher_id' => $teacherId,
            'class_id' => $classEightId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $studentId = DB::table('students')->insertGetId([
            'admission_number' => 'SNAP-001',
            'full_name' => 'Snapshot Student',
            'class_id' => $classEightId,
            'login_id' => 'SNAP-001',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $subjectId = DB::table('subjects')->insertGetId([
            'name' => 'Mathematics',
            'category' => 'core',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $examId = DB::table('exams')->insertGetId([
            'name' => 'Mid Term',
            'class_id' => $classEightId,
            'subject_id' => $subjectId,
            'exam_date' => '2026-03-20',
            'exam_time' => '10:00:00',
            'max_marks' => 100,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withHeaders(['Authorization' => 'Bearer '.$teacherToken])
            ->putJson('/teacher/attendance', [
                'date' => '2026-03-15',
                'records' => [
                    ['student_id' => $studentId, 'status' => 'present'],
                ],
            ])
            ->assertOk();

        $this->withHeaders(['Authorization' => 'Bearer '.$adminToken])
            ->putJson('/exams/'.$examId.'/marks', [
                'records' => [
                    ['student_id' => $studentId, 'marks_obtained' => 84, 'grade' => 'A', 'remarks' => 'Good'],
                ],
            ])
            ->assertOk();

        $this->withHeaders(['Authorization' => 'Bearer '.$adminToken])
            ->postJson('/promotion/execute-single', [
                'student_id' => $studentId,
                'target_class_id' => $classNineId,
                'academic_year' => '2026-2027',
            ])
            ->assertOk();

        $history = $this->withHeaders(['Authorization' => 'Bearer '.$adminToken])
            ->getJson('/students/history?admission_number=SNAP-001')
            ->assertOk()
            ->json();

        $this->assertSame('9', $history['student']['classes']['name']);
        $this->assertSame('8', $history['attendance'][0]['classes']['name']);
        $this->assertSame('8', $history['exam_marks'][0]['exams']['classes']['name']);
        $this->assertNotEmpty($history['attendance'][0]['class_id_snapshot']);
        $this->assertNotEmpty($history['exam_marks'][0]['exams']['class_id']);
    }

    private function createUserWithRole(string $role): string
    {
        $plainToken = 'tok_'.bin2hex(random_bytes(16));
        $userId = DB::table('users')->insertGetId([
            'name' => ucfirst($role).' User',
            'email' => $role.'_'.bin2hex(random_bytes(4)).'@test.local',
            'password' => Hash::make('password123'),
            'api_token' => hash('sha256', $plainToken),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('user_roles')->insert([
            'user_id' => $userId,
            'role' => $role,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('profiles')->insert([
            'user_id' => $userId,
            'full_name' => ucfirst($role).' User',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($role === 'teacher') {
            DB::table('teachers')->insert([
                'user_id' => $userId,
                'teacher_id' => 'TCH'.strtoupper(substr(bin2hex(random_bytes(4)), 0, 6)),
                'status' => 'active',
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

        if (! Schema::hasTable('user_roles')) {
            Schema::create('user_roles', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->unique();
                $table->string('role');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('profiles')) {
            Schema::create('profiles', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->unique();
                $table->string('full_name');
                $table->string('email')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('teachers')) {
            Schema::create('teachers', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable()->unique();
                $table->string('teacher_id')->unique();
                $table->string('status')->default('active');
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

        if (! Schema::hasTable('teacher_classes')) {
            Schema::create('teacher_classes', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('teacher_id');
                $table->unsignedBigInteger('class_id');
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
                $table->date('date_of_birth')->nullable();
                $table->string('blood_group')->nullable();
                $table->string('photo_url')->nullable();
                $table->string('parent_name')->nullable();
                $table->string('parent_phone')->nullable();
                $table->text('address')->nullable();
                $table->string('emergency_contact')->nullable();
                $table->string('emergency_contact_name')->nullable();
                $table->string('login_id')->nullable();
                $table->string('status')->default('active');
                $table->timestamps();
            });
        } else {
            Schema::table('students', function (Blueprint $table): void {
                foreach ([
                    'date_of_birth' => fn () => $table->date('date_of_birth')->nullable()->after('user_id'),
                    'blood_group' => fn () => $table->string('blood_group')->nullable()->after('date_of_birth'),
                    'photo_url' => fn () => $table->string('photo_url')->nullable()->after('blood_group'),
                    'parent_name' => fn () => $table->string('parent_name')->nullable()->after('photo_url'),
                    'parent_phone' => fn () => $table->string('parent_phone')->nullable()->after('parent_name'),
                    'address' => fn () => $table->text('address')->nullable()->after('parent_phone'),
                    'emergency_contact' => fn () => $table->string('emergency_contact')->nullable()->after('address'),
                    'emergency_contact_name' => fn () => $table->string('emergency_contact_name')->nullable()->after('emergency_contact'),
                    'login_id' => fn () => $table->string('login_id')->nullable()->after('emergency_contact_name'),
                    'status' => fn () => $table->string('status')->default('active')->after('login_id'),
                ] as $column => $callback) {
                    if (! Schema::hasColumn('students', $column)) {
                        $callback();
                    }
                }
            });
        }

        if (! Schema::hasTable('attendance')) {
            Schema::create('attendance', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('student_id');
                $table->unsignedBigInteger('class_id_snapshot')->nullable();
                $table->string('class_name_snapshot')->nullable();
                $table->string('class_section_snapshot')->nullable();
                $table->date('date');
                $table->string('status');
                $table->unsignedBigInteger('marked_by')->nullable();
                $table->timestamps();
            });
        } else {
            Schema::table('attendance', function (Blueprint $table): void {
                if (! Schema::hasColumn('attendance', 'class_id_snapshot')) {
                    $table->unsignedBigInteger('class_id_snapshot')->nullable()->after('student_id');
                }
                if (! Schema::hasColumn('attendance', 'class_name_snapshot')) {
                    $table->string('class_name_snapshot')->nullable()->after('class_id_snapshot');
                }
                if (! Schema::hasColumn('attendance', 'class_section_snapshot')) {
                    $table->string('class_section_snapshot')->nullable()->after('class_name_snapshot');
                }
                if (! Schema::hasColumn('attendance', 'marked_by')) {
                    $table->unsignedBigInteger('marked_by')->nullable()->after('status');
                }
            });
        }

        if (! Schema::hasTable('subjects')) {
            Schema::create('subjects', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->string('category')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('exams')) {
            Schema::create('exams', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->unsignedBigInteger('class_id')->nullable();
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->date('exam_date')->nullable();
                $table->time('exam_time')->nullable();
                $table->integer('max_marks')->default(100);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('exam_marks')) {
            Schema::create('exam_marks', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('exam_id');
                $table->unsignedBigInteger('student_id');
                $table->unsignedBigInteger('class_id_snapshot')->nullable();
                $table->string('class_name_snapshot')->nullable();
                $table->string('class_section_snapshot')->nullable();
                $table->decimal('marks_obtained', 8, 2)->nullable();
                $table->string('grade', 20)->nullable();
                $table->text('remarks')->nullable();
                $table->timestamps();
            });
        } else {
            Schema::table('exam_marks', function (Blueprint $table): void {
                if (! Schema::hasColumn('exam_marks', 'class_id_snapshot')) {
                    $table->unsignedBigInteger('class_id_snapshot')->nullable()->after('student_id');
                }
                if (! Schema::hasColumn('exam_marks', 'class_name_snapshot')) {
                    $table->string('class_name_snapshot')->nullable()->after('class_id_snapshot');
                }
                if (! Schema::hasColumn('exam_marks', 'class_section_snapshot')) {
                    $table->string('class_section_snapshot')->nullable()->after('class_name_snapshot');
                }
            });
        }

        if (! Schema::hasTable('promotion_history')) {
            Schema::create('promotion_history', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('student_id');
                $table->unsignedBigInteger('from_class_id')->nullable();
                $table->unsignedBigInteger('to_class_id')->nullable();
                $table->string('from_admission_number')->nullable();
                $table->string('to_admission_number')->nullable();
                $table->string('from_login_id')->nullable();
                $table->string('to_login_id')->nullable();
                $table->string('academic_year', 20);
                $table->unsignedBigInteger('promoted_by');
                $table->timestamps();
            });
        }
    }
}
