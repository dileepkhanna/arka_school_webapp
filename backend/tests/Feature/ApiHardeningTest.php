<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Tests\TestCase;

class ApiHardeningTest extends TestCase
{
    use WithFaker;

    protected function setUp(): void
    {
        parent::setUp();

        try {
            DB::connection()->getPdo();
        } catch (\Throwable $e) {
            $this->markTestSkipped('Database unavailable for API hardening tests: '.$e->getMessage());
        }

        $this->ensureMinimumSchema();
    }

    public function test_admin_syllabus_endpoint_forbids_non_admin(): void
    {
        $token = $this->createUserWithRole('teacher');

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/admin/syllabus/data');

        $response->assertStatus(403);
    }

    public function test_students_by_class_forbids_parent_role(): void
    {
        $token = $this->createUserWithRole('parent');

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->getJson('/api/messaging/students/class/1');

        $response->assertStatus(403);
    }

    public function test_mark_read_only_updates_for_actual_recipient(): void
    {
        $senderToken = $this->createUserWithRole('teacher');
        $recipientToken = $this->createUserWithRole('teacher');

        $senderId = $this->tokenOwnerId($senderToken);
        $recipientId = $this->tokenOwnerId($recipientToken);

        $messageId = DB::table('messages')->insertGetId([
            'sender_id' => $senderId,
            'recipient_id' => $recipientId,
            'content' => 'hello',
            'is_read' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withHeaders([
            'Authorization' => 'Bearer '.$senderToken,
        ])->putJson('/api/messaging/messages/'.$messageId.'/read')->assertOk();

        $this->assertFalse((bool) DB::table('messages')->where('id', $messageId)->value('is_read'));

        $this->withHeaders([
            'Authorization' => 'Bearer '.$recipientToken,
        ])->putJson('/api/messaging/messages/'.$messageId.'/read')->assertOk();

        $this->assertTrue((bool) DB::table('messages')->where('id', $messageId)->value('is_read'));
    }

    private function createUserWithRole(string $role): string
    {
        $plainToken = 'tok_'.bin2hex(random_bytes(16));
        $userId = DB::table('users')->insertGetId([
            'name' => 'T '.$this->faker->firstName(),
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
                $table->rememberToken();
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

        if (! Schema::hasTable('messages')) {
            Schema::create('messages', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('sender_id');
                $table->unsignedBigInteger('recipient_id');
                $table->unsignedBigInteger('student_id')->nullable();
                $table->text('content');
                $table->boolean('is_read')->default(false);
                $table->string('attachment_url')->nullable();
                $table->string('attachment_type')->nullable();
                $table->timestamps();
            });
        }
    }
}
