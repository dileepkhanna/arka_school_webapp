<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('timetable')) {
            return;
        }

        Schema::create('timetable', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('class_id');
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->unsignedBigInteger('teacher_id')->nullable();
            $table->string('day_of_week', 20);
            $table->unsignedInteger('period_number');
            $table->time('start_time');
            $table->time('end_time');
            $table->boolean('is_published')->default(false);
            $table->timestamps();

            $table->unique(['class_id', 'day_of_week', 'period_number'], 'timetable_class_day_period_unique');
            $table->index(['teacher_id', 'is_published']);
            $table->index(['class_id', 'is_published']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timetable');
    }
};
