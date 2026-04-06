<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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

                $table->index('class_id');
                $table->index('subject_id');
                $table->index('exam_date');
            });
        }

        if (! Schema::hasTable('exam_marks')) {
            Schema::create('exam_marks', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('exam_id');
                $table->unsignedBigInteger('student_id');
                $table->decimal('marks_obtained', 8, 2)->nullable();
                $table->string('grade', 20)->nullable();
                $table->text('remarks')->nullable();
                $table->timestamps();

                $table->unique(['exam_id', 'student_id']);
                $table->index('student_id');
            });
        }

        if (! Schema::hasTable('exam_cycles')) {
            Schema::create('exam_cycles', function (Blueprint $table): void {
                $table->id();
                $table->string('exam_type', 30);
                $table->unsignedInteger('cycle_number');
                $table->date('start_date');
                $table->date('end_date');
                $table->boolean('is_active')->default(false);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index(['exam_type', 'is_active']);
            });
        }

        if (! Schema::hasTable('weekly_exams')) {
            Schema::create('weekly_exams', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('class_id');
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->string('syllabus_type', 30)->default('general');
                $table->unsignedBigInteger('cycle_id')->nullable();
                $table->unsignedInteger('week_number')->nullable();
                $table->string('exam_title');
                $table->date('exam_date');
                $table->time('exam_time');
                $table->unsignedInteger('duration_minutes')->default(60);
                $table->unsignedInteger('total_marks')->default(100);
                $table->boolean('negative_marking')->default(false);
                $table->decimal('negative_marks_value', 8, 2)->default(0);
                $table->boolean('reminder_enabled')->default(false);
                $table->string('status', 30)->default('scheduled');
                $table->text('description')->nullable();
                $table->string('exam_type_label')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index('class_id');
                $table->index('subject_id');
                $table->index('exam_date');
                $table->index('status');
            });
        }

        if (! Schema::hasTable('weekly_exam_syllabus')) {
            Schema::create('weekly_exam_syllabus', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('exam_id');
                $table->unsignedBigInteger('syllabus_id');

                $table->unique(['exam_id', 'syllabus_id']);
                $table->index('syllabus_id');
            });
        }

        if (! Schema::hasTable('student_exam_results')) {
            Schema::create('student_exam_results', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('exam_id');
                $table->unsignedBigInteger('student_id');
                $table->decimal('obtained_marks', 8, 2)->default(0);
                $table->decimal('total_marks', 8, 2)->nullable();
                $table->decimal('percentage', 8, 2)->default(0);
                $table->unsignedInteger('rank')->nullable();
                $table->timestamps();

                $table->unique(['exam_id', 'student_id']);
                $table->index('student_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('student_exam_results');
        Schema::dropIfExists('weekly_exam_syllabus');
        Schema::dropIfExists('weekly_exams');
        Schema::dropIfExists('exam_cycles');
        Schema::dropIfExists('exam_marks');
        Schema::dropIfExists('exams');
    }
};
