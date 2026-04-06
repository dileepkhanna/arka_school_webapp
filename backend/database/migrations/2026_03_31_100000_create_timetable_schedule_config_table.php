<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('timetable_schedule_config')) {
            return;
        }

        Schema::create('timetable_schedule_config', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('slot_order'); // Order in the schedule
            $table->unsignedInteger('period_number')->default(0); // 0 for breaks, 1-N for periods
            $table->time('start_time');
            $table->time('end_time');
            $table->boolean('is_break')->default(false);
            $table->string('break_name', 100)->nullable();
            $table->timestamps();

            $table->unique('slot_order');
            $table->index('is_break');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timetable_schedule_config');
    }
};
