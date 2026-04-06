<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('academic_calendar_entries')) {
            Schema::create('academic_calendar_entries', function (Blueprint $table): void {
                $table->id();
                $table->string('title', 255);
                $table->string('category', 50)->default('holiday');
                $table->string('subcategory', 255)->nullable();
                $table->date('start_date');
                $table->date('end_date')->nullable();
                $table->boolean('all_day')->default(true);
                $table->time('start_time')->nullable();
                $table->time('end_time')->nullable();
                $table->text('description')->nullable();
                $table->string('image_url', 2048)->nullable();
                $table->string('location', 255)->nullable();
                $table->boolean('is_recurring')->default(false);
                $table->string('recurrence_rule', 255)->nullable();
                $table->string('audience_type', 50)->default('all');
                $table->json('audience_roles')->nullable();
                $table->json('audience_class_ids')->nullable();
                $table->json('audience_user_ids')->nullable();
                $table->boolean('notify_enabled')->default(true);
                $table->json('notify_offsets_days')->nullable();
                $table->string('status', 50)->default('published');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();

                $table->index(['start_date', 'end_date']);
                $table->index(['category', 'status']);
                $table->index('audience_type');
                $table->index('notify_enabled');
                $table->index('is_recurring');
            });
        }

        if (Schema::hasTable('holidays') && Schema::hasTable('academic_calendar_entries')) {
            $alreadyMigrated = DB::table('academic_calendar_entries')->exists();

            if (! $alreadyMigrated) {
                $rows = DB::table('holidays')->get();

                foreach ($rows as $row) {
                    DB::table('academic_calendar_entries')->insert([
                        'title' => $row->name,
                        'category' => 'holiday',
                        'subcategory' => $row->type,
                        'start_date' => $row->start_date,
                        'end_date' => $row->end_date,
                        'all_day' => true,
                        'start_time' => null,
                        'end_time' => null,
                        'description' => $row->description,
                        'image_url' => $row->image_url,
                        'location' => null,
                        'is_recurring' => (bool) $row->is_recurring,
                        'recurrence_rule' => null,
                        'audience_type' => 'all',
                        'audience_roles' => null,
                        'audience_class_ids' => null,
                        'audience_user_ids' => null,
                        'notify_enabled' => true,
                        'notify_offsets_days' => json_encode([3, 2, 1]),
                        'status' => 'published',
                        'created_by' => $row->created_by,
                        'updated_by' => $row->created_by,
                        'created_at' => $row->created_at,
                        'updated_at' => $row->updated_at,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('academic_calendar_entries');
    }
};
