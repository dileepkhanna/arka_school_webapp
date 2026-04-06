<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PromotionFlowTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        try {
            DB::connection()->getPdo();
        } catch (\Throwable $e) {
            $this->markTestSkipped('Database unavailable for promotion flow tests: '.$e->getMessage());
        }

        $this->ensureMinimumSchema();
    }

    public function test_single_rollback_restores_original_student_values(): void
    {
        $token = $this->createAdminToken();
        [$fromClassId, $toClassId] = $this->createClasses();
        $studentId = $this->createStudent($fromClassId, 'JOHN-8-A');

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/promotion/execute-single', [
                'student_id' => $studentId,
                'target_class_id' => $toClassId,
                'academic_year' => '2026-2027',
            ])
            ->assertOk();

        $historyId = (int) DB::table('promotion_history')->where('student_id', $studentId)->value('id');

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/promotion/rollback-single', [
                'promotion_history_id' => $historyId,
            ])
            ->assertOk()
            ->assertJsonPath('restored_student_id', $studentId);

        $student = DB::table('students')->where('id', $studentId)->first();

        $this->assertSame($fromClassId, $student->class_id);
        $this->assertSame('JOHN-8-A', $student->admission_number);
        $this->assertSame('JOHN-8-A', $student->login_id);
        $this->assertDatabaseMissing('promotion_history', ['id' => $historyId]);
    }

    public function test_batch_rollback_restores_only_students_from_that_batch(): void
    {
        $token = $this->createAdminToken();
        [$fromClassId, $toClassId] = $this->createClasses();
        $promotedStudentId = $this->createStudent($fromClassId, 'ALICE-8-A');
        $nativeStudentId = $this->createStudent($toClassId, 'BOB-9-A');

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/promotion/execute-single', [
                'student_id' => $promotedStudentId,
                'target_class_id' => $toClassId,
                'academic_year' => '2026-2027',
            ])
            ->assertOk();

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/promotion/rollback', [
                'batch_academic_year' => '2026-2027',
                'source_class_id' => $fromClassId,
                'target_class_id' => $toClassId,
            ])
            ->assertOk()
            ->assertJsonPath('restored_count', 1)
            ->assertJsonPath('skipped_count', 0);

        $promotedStudent = DB::table('students')->where('id', $promotedStudentId)->first();
        $nativeStudent = DB::table('students')->where('id', $nativeStudentId)->first();

        $this->assertSame($fromClassId, $promotedStudent->class_id);
        $this->assertSame($toClassId, $nativeStudent->class_id);
    }

    public function test_single_rollback_returns_conflict_when_student_class_already_changed(): void
    {
        $token = $this->createAdminToken();
        [$fromClassId, $toClassId] = $this->createClasses();
        $studentId = $this->createStudent($fromClassId, 'RAVI-8-A');

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/promotion/execute-single', [
                'student_id' => $studentId,
                'target_class_id' => $toClassId,
                'academic_year' => '2026-2027',
            ])
            ->assertOk();

        DB::table('students')->where('id', $studentId)->update(['class_id' => null]);
        $historyId = (int) DB::table('promotion_history')->where('student_id', $studentId)->value('id');

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/promotion/rollback-single', [
                'promotion_history_id' => $historyId,
            ])
            ->assertStatus(409);
    }

    private function createAdminToken(): string
    {
        $plainToken = 'tok_'.bin2hex(random_bytes(16));
        $userId = DB::table('users')->insertGetId([
            'name' => 'Admin User',
            'email' => 'admin_'.bin2hex(random_bytes(4)).'@test.local',
            'password' => Hash::make('password123'),
            'api_token' => hash('sha256', $plainToken),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('user_roles')->insert([
            'user_id' => $userId,
            'role' => 'admin',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $plainToken;
    }

    private function createClasses(): array
    {
        $fromClassId = DB::table('classes')->insertGetId([
            'name' => '8',
            'section' => 'A',
            'academic_year' => '2025-2026',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $toClassId = DB::table('classes')->insertGetId([
            'name' => '9',
            'section' => 'A',
            'academic_year' => '2026-2027',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [$fromClassId, $toClassId];
    }

    private function createStudent(int $classId, string $identifier): int
    {
        return DB::table('students')->insertGetId([
            'admission_number' => $identifier,
            'full_name' => explode('-', $identifier)[0].' Student',
            'class_id' => $classId,
            'login_id' => $identifier,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
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
                $table->string('login_id')->nullable();
                $table->string('status')->default('active');
                $table->timestamps();
            });
        } else {
            Schema::table('students', function (Blueprint $table): void {
                if (! Schema::hasColumn('students', 'login_id')) {
                    $table->string('login_id')->nullable()->after('user_id');
                }
                if (! Schema::hasColumn('students', 'status')) {
                    $table->string('status')->default('active')->after('login_id');
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
        } else {
            Schema::table('promotion_history', function (Blueprint $table): void {
                if (! Schema::hasColumn('promotion_history', 'from_admission_number')) {
                    $table->string('from_admission_number')->nullable()->after('to_class_id');
                }
                if (! Schema::hasColumn('promotion_history', 'to_admission_number')) {
                    $table->string('to_admission_number')->nullable()->after('from_admission_number');
                }
                if (! Schema::hasColumn('promotion_history', 'from_login_id')) {
                    $table->string('from_login_id')->nullable()->after('to_admission_number');
                }
                if (! Schema::hasColumn('promotion_history', 'to_login_id')) {
                    $table->string('to_login_id')->nullable()->after('from_login_id');
                }
            });
        }
    }
}
