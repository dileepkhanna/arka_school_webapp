<?php

use App\Services\AcademicCalendarReminderService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('academic-calendar:send-reminders', function (AcademicCalendarReminderService $service): void {
    $sentCount = $service->sendDueReminders();

    $this->info("Academic calendar reminder run complete. Notifications queued: {$sentCount}");
})->purpose('Send academic calendar reminder notifications');
