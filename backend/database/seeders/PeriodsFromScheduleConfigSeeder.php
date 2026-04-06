<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PeriodsFromScheduleConfigSeeder extends Seeder
{
    /**
     * Seed the periods table from timetable_schedule_config if it exists.
     * This helps migrate from the old schedule config to the new periods system.
     */
    public function run(): void
    {
        if (!Schema::hasTable('periods') || !Schema::hasTable('timetable_schedule_config')) {
            $this->command->info('Required tables not found. Skipping seeder.');
            return;
        }

        // Check if periods table already has data
        if (DB::table('periods')->count() > 0) {
            $this->command->info('Periods table already has data. Skipping seeder.');
            return;
        }

        $scheduleConfig = DB::table('timetable_schedule_config')
            ->orderBy('slot_order')
            ->get();

        if ($scheduleConfig->isEmpty()) {
            $this->command->info('No schedule config found. Skipping seeder.');
            return;
        }

        foreach ($scheduleConfig as $slot) {
            // Map is_break to period type
            $type = $slot->is_break ? 'break' : 'lesson';
            
            // Use break_name as label if available, otherwise generate label
            $label = $slot->is_break && $slot->break_name 
                ? $slot->break_name 
                : "Period {$slot->period_number}";

            DB::table('periods')->insert([
                'period_number' => $slot->period_number,
                'label' => $label,
                'type' => $type,
                'start_time' => $slot->start_time,
                'end_time' => $slot->end_time,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->command->info('Successfully seeded periods from schedule config.');
    }
}
