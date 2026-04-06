<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('syllabus')) {
            Schema::create('syllabus', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('class_id');
                $table->unsignedBigInteger('subject_id');
                $table->string('syllabus_type', 30)->default('general');
                $table->string('exam_type')->nullable();
                $table->string('chapter_name')->nullable();
                $table->string('topic_name');
                $table->unsignedInteger('week_number')->nullable();
                $table->date('schedule_date')->nullable();
                $table->time('schedule_time')->nullable();
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->unsignedBigInteger('completed_by')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index('class_id');
                $table->index('subject_id');
                $table->index('syllabus_type');
                $table->index('exam_type');
            });
        }

        if (! Schema::hasTable('teacher_syllabus_map')) {
            Schema::create('teacher_syllabus_map', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('teacher_id');
                $table->unsignedBigInteger('syllabus_id');
                $table->string('role_type', 30)->default('lead');
                $table->timestamps();

                $table->unique(['teacher_id', 'syllabus_id', 'role_type'], 'teacher_syllabus_unique');
                $table->index('syllabus_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_syllabus_map');
        Schema::dropIfExists('syllabus');
    }
};
