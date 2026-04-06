<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TimetableScheduleConfigSeeder extends Seeder
{
    public function run(): void
    {
        $schedule = [
            ['slot_order' => 1, 'period_number' => 1, 'start_time' => '08:00', 'end_time' => '08:45', 'is_break' => false, 'break_name' => null],
            ['slot_order' => 2, 'period_number' => 2, 'start_time' => '08:45', 'end_time' => '09:30', 'is_break' => false, 'break_name' => null],
            ['slot_order' => 3, 'period_number' => 0, 'start_time' => '09:30', 'end_time' => '09:45', 'is_break' => true, 'break_name' => 'Short Break'],
            ['slot_order' => 4, 'period_number' => 3, 'start_time' => '09:45', 'end_time' => '10:30', 'is_break' => false, 'break_name' => null],
            ['slot_order' => 5, 'period_number' => 4, 'start_time' => '10:30', 'end_time' => '11:15', 'is_break' => false, 'break_name' => null],
            ['slot_order' => 6, 'period_number' => 0, 'start_time' => '11:15', 'end_time' => '11:30', 'is_break' => true, 'break_name' => 'Short Break'],
            ['slot_order' => 7, 'period_number' => 5, 'start_time' => '11:30', 'end_time' => '12:15', 'is_break' => false, 'break_name' => null],
            ['slot_order' => 8, 'period_number' => 6, 'start_time' => '12:15', 'end_time' => '13:00', 'is_break' => false, 'break_name' => null],
            ['slot_order' => 9, 'period_number' => 0, 'start_time' => '13:00', 'end_time' => '14:00', 'is_break' => true, 'break_name' => 'Lunch Break'],
            ['slot_order' => 10, 'period_number' => 7, 'start_time' => '14:00', 'end_time' => '14:45', 'is_break' => false, 'break_name' => null],
            ['slot_order' => 11, 'period_number' => 8, 'start_time' => '14:45', 'end_time' => '15:30', 'is_break' => false, 'break_name' => null],
        ];

        foreach ($schedule as $slot) {
            $slot['created_at'] = now();
            $slot['updated_at'] = now();
            DB::table('timetable_schedule_config')->insert($slot);
        }

        $this->command->info('Timetable schedule configuration seeded successfully!');
    }
}
