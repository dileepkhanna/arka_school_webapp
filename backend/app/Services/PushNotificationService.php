<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class PushNotificationService
{
    public function sendToUsers(array $userIds, array $payload): void
    {
        $userIds = collect($userIds)
            ->filter(fn ($id) => is_numeric($id) && (int) $id > 0)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if (empty($userIds) || ! Schema::hasTable('push_subscriptions')) {
            return;
        }

        $publicKey = (string) env('VAPID_PUBLIC_KEY', '');
        $privateKey = (string) env('VAPID_PRIVATE_KEY', '');

        if ($publicKey === '' || $privateKey === '') {
            return;
        }

        if (Schema::hasTable('notification_preferences')) {
            $userIds = collect($userIds)
                ->filter(function (int $userId) use ($payload): bool {
                    $preference = DB::table('notification_preferences')->where('user_id', $userId)->first();
                    if (! $preference) {
                        return true;
                    }

                    if (! (bool) $preference->enable_push) {
                        return false;
                    }

                    if ((bool) $preference->critical_only_push) {
                        $priority = strtolower((string) ($payload['priority'] ?? 'normal'));

                        return $priority === 'critical';
                    }

                    return true;
                })
                ->values()
                ->all();
        }

        if (empty($userIds)) {
            return;
        }

        $subscriptions = DB::table('push_subscriptions')
            ->whereIn('user_id', $userIds)
            ->select('id', 'user_id', 'endpoint', 'p256dh', 'auth')
            ->get();

        if ($subscriptions->isEmpty()) {
            return;
        }

        $webPush = new WebPush([
            'VAPID' => [
                'subject' => (string) env('VAPID_SUBJECT', 'mailto:admin@smarteduconnect.local'),
                'publicKey' => $publicKey,
                'privateKey' => $privateKey,
            ],
        ], [
            'timeout' => 5,
            'connect_timeout' => 5,
        ]);

        $encodedPayload = json_encode($payload);
        if ($encodedPayload === false) {
            return;
        }

        foreach ($subscriptions as $subscription) {
            try {
                $webPush->queueNotification(
                    Subscription::create([
                        'endpoint' => $subscription->endpoint,
                        'keys' => [
                            'p256dh' => $subscription->p256dh,
                            'auth' => $subscription->auth,
                        ],
                    ]),
                    $encodedPayload
                );
            } catch (\Throwable $e) {
                DB::table('push_subscriptions')->where('id', $subscription->id)->delete();

                Log::error('Invalid push subscription removed', [
                    'subscription_id' => $subscription->id,
                    'user_id' => $subscription->user_id,
                    'reason' => $e->getMessage(),
                ]);
            }
        }

        try {
            foreach ($webPush->flush() as $report) {
                if ($report->isSuccess()) {
                    continue;
                }

                $endpoint = (string) $report->getRequest()->getUri();

                if ($report->isSubscriptionExpired()) {
                    DB::table('push_subscriptions')->where('endpoint', $endpoint)->delete();
                }

                Log::error('Push delivery failed', [
                    'endpoint' => $endpoint,
                    'reason' => $report->getReason(),
                    'expired' => $report->isSubscriptionExpired(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('Push delivery flush failed', [
                'reason' => $e->getMessage(),
            ]);
        }
    }
}
