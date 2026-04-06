<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('timetable') || !Schema::hasTable('periods')) {
            return;
        }

        // Add nullable period_id column
        Schema::table('timetable', function (Blueprint $table): void {
            $table->unsignedBigInteger('period_id')->nullable()->after('day_of_week');
            $table->foreign('period_id')->references('id')->on('periods')->onDelete('restrict');
        });

        // Check if timetable has any rows
        $timetableCount = DB::table('timetable')->count();
        if ($timetableCount === 0) {
            // No timetable data, skip back-fill but still make column non-nullable
            Schema::table('timetable', function (Blueprint $table): void {
                $table->unsignedBigInteger('period_id')->nullable(false)->change();
            });
            return;
        }

        // Get distinct period combinations from timetable
        $distinctPeriods = DB::table('timetable')
            ->select('period_number', 'start_time', 'end_time')
            ->distinct()
            ->orderBy('period_number')
            ->get();

        // Create periods and map them
        $periodMap = [];
        foreach ($distinctPeriods as $period) {
            // Check if period already exists
            $existingPeriod = DB::table('periods')
                ->where('period_number', $period->period_number)
                ->where('start_time', $period->start_time)
                ->where('end_time', $period->end_time)
                ->first();

            if ($existingPeriod) {
                $periodId = $existingPeriod->id;
            } else {
                $periodId = DB::table('periods')->insertGetId([
                    'period_number' => $period->period_number,
                    'label' => "Period {$period->period_number}",
                    'type' => 'lesson',
                    'start_time' => $period->start_time,
                    'end_time' => $period->end_time,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $key = "{$period->period_number}|{$period->start_time}|{$period->end_time}";
            $periodMap[$key] = $periodId;
        }

        // Update timetable rows with period_id
        foreach ($periodMap as $key => $periodId) {
            [$periodNumber, $startTime, $endTime] = explode('|', $key);
            DB::table('timetable')
                ->where('period_number', $periodNumber)
                ->where('start_time', $startTime)
                ->where('end_time', $endTime)
                ->update(['period_id' => $periodId]);
        }

        // Verify no null period_id rows remain
        $nullCount = DB::table('timetable')->whereNull('period_id')->count();
        if ($nullCount > 0) {
            throw new \Exception("Migration failed: {$nullCount} timetable rows still have null period_id");
        }

        // Make period_id non-nullable
        Schema::table('timetable', function (Blueprint $table): void {
            $table->unsignedBigInteger('period_id')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('timetable')) {
            return;
        }

        Schema::table('timetable', function (Blueprint $table): void {
            $table->dropForeign(['period_id']);
            $table->dropColumn('period_id');
        });
    }
};
