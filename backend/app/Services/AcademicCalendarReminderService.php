<?php

namespace App\Services;

use App\Models\AcademicCalendarEntry;
use Carbon\Carbon;

class AcademicCalendarReminderService
{
    public function sendDueReminders(?Carbon $today = null): int
    {
        $today = ($today ?? now())->copy()->startOfDay();
        $sentCount = 0;

        $entries = AcademicCalendarEntry::query()
            ->published()
            ->where('notify_enabled', true)
            ->get();

        foreach ($entries as $entry) {
            [$startDate] = $entry->is_recurring
                ? $entry->nextOccurrenceFrom($today)
                : [Carbon::parse($entry->start_date)->startOfDay(), $entry->end_date ? Carbon::parse($entry->end_date)->startOfDay() : null];

            if ($startDate->lt($today)) {
                continue;
            }

            $daysRemaining = (int) $today->diffInDays($startDate);
            if (! in_array($daysRemaining, $entry->normalizedNotifyOffsets(), true)) {
                continue;
            }

            $userIds = $entry->audienceUserIds();
            if (empty($userIds)) {
                continue;
            }

            $title = sprintf('Upcoming %s: %s', $this->categoryLabel($entry->category), $entry->title);
            $message = $this->buildMessage($entry, $startDate, $daysRemaining);

            foreach ($userIds as $userId) {
                app(NotificationService::class)->notifyUsers([$userId], $title, $message, [
                    'type' => 'academic_calendar',
                    'priority' => 'normal',
                    'entity_type' => 'academic_calendar',
                    'entity_id' => $entry->id,
                    'channel' => 'both',
                    'dedupe_key' => sprintf('academic-calendar:%d:%d:%d', $entry->id, $daysRemaining, $userId),
                    'link' => '/admin/academic-calendar',
                    'meta' => [
                        'days_before' => $daysRemaining,
                        'category' => $entry->category,
                        'start_date' => $startDate->toDateString(),
                    ],
                ]);
                $sentCount++;
            }
        }

        return $sentCount;
    }

    private function categoryLabel(string $category): string
    {
        return match ($category) {
            AcademicCalendarEntry::CATEGORY_ACADEMIC_ACTIVITY => 'Academic Activity',
            AcademicCalendarEntry::CATEGORY_IMPORTANT_DATE => 'Important Date',
            default => ucfirst(str_replace('_', ' ', $category)),
        };
    }

    private function buildMessage(AcademicCalendarEntry $entry, Carbon $startDate, int $daysRemaining): string
    {
        if ($daysRemaining === 1) {
            if (! $entry->all_day && $entry->start_time) {
                return sprintf('%s is tomorrow at %s.', $entry->title, Carbon::createFromFormat('H:i:s', $entry->start_time)->format('g:i A'));
            }

            return sprintf('%s is tomorrow on %s.', $entry->title, $startDate->toDateString());
        }

        return sprintf('%s starts in %d days on %s.', $entry->title, $daysRemaining, $startDate->toDateString());
    }
}
