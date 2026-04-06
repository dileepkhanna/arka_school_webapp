<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class NotificationService
{
    public function notifyUsers(array $userIds, string $title, string $message, array $options = []): void
    {
        if (! Schema::hasTable('notifications')) {
            return;
        }

        $userIds = collect($userIds)
            ->filter(fn ($id) => is_numeric($id) && (int) $id > 0)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if (empty($userIds)) {
            return;
        }

        $type = (string) ($options['type'] ?? 'general');
        $link = $options['link'] ?? null;
        $priority = (string) ($options['priority'] ?? 'normal');
        $entityType = $options['entity_type'] ?? null;
        $entityId = $options['entity_id'] ?? null;
        $channel = (string) ($options['channel'] ?? 'both');
        $dedupeKey = $options['dedupe_key'] ?? null;
        $meta = $options['meta'] ?? null;

        $hasEntityType = Schema::hasColumn('notifications', 'entity_type');
        $hasEntityId = Schema::hasColumn('notifications', 'entity_id');
        $hasPriority = Schema::hasColumn('notifications', 'priority');
        $hasChannel = Schema::hasColumn('notifications', 'channel');
        $hasDedupeKey = Schema::hasColumn('notifications', 'dedupe_key');
        $hasMetaJson = Schema::hasColumn('notifications', 'meta_json');

        $now = now();
        $rows = [];
        $rolesByUserId = DB::table('user_roles')
            ->whereIn('user_id', $userIds)
            ->pluck('role', 'user_id')
            ->mapWithKeys(fn ($role, $userId) => [(int) $userId => (string) $role])
            ->all();
        $pushRecipientsByLink = [];

        foreach ($userIds as $userId) {
            if ($hasDedupeKey && is_string($dedupeKey) && $dedupeKey !== '') {
                $alreadyExists = DB::table('notifications')
                    ->where('user_id', $userId)
                    ->where('dedupe_key', $dedupeKey)
                    ->exists();

                if ($alreadyExists) {
                    continue;
                }
            }

            $userLink = $this->linkForUser($link, $rolesByUserId[$userId] ?? null);

            $row = [
                'user_id' => $userId,
                'title' => $title,
                'message' => $message,
                'type' => $type,
                'link' => $userLink,
                'is_read' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if ($hasEntityType) {
                $row['entity_type'] = $entityType;
            }
            if ($hasEntityId) {
                $row['entity_id'] = $entityId !== null ? (string) $entityId : null;
            }
            if ($hasPriority) {
                $row['priority'] = $priority;
            }
            if ($hasChannel) {
                $row['channel'] = $channel;
            }
            if ($hasDedupeKey) {
                $row['dedupe_key'] = $dedupeKey;
            }
            if ($hasMetaJson) {
                $row['meta_json'] = $meta !== null ? json_encode($meta) : null;
            }

            $rows[] = $row;
            $pushRecipientsByLink[$userLink ?? '/'][] = $userId;
        }

        if (empty($rows)) {
            return;
        }

        DB::table('notifications')->insert($rows);

        if ($channel !== 'in_app') {
            app()->terminating(function () use ($pushRecipientsByLink, $title, $message, $type, $priority, $entityType, $entityId): void {
                foreach ($pushRecipientsByLink as $pushLink => $recipientIds) {
                    app(PushNotificationService::class)->sendToUsers($recipientIds, [
                        'title' => $title,
                        'message' => $message,
                        'url' => $pushLink,
                        'tag' => 'smarteduconnect-'.$type,
                        'priority' => $priority,
                        'entityType' => $entityType,
                        'entityId' => $entityId,
                    ]);
                }
            });
        }
    }

    private function linkForUser(?string $link, ?string $role): ?string
    {
        if (! is_string($link) || $link === '' || ! is_string($role) || $role === '') {
            return $link;
        }

        return preg_replace('/^\/(admin|teacher|parent)\//', '/'.$role.'/', $link) ?? $link;
    }
}
