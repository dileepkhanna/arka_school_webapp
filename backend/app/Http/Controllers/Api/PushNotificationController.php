<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PushNotificationController extends Controller
{
    public function vapidKey(): JsonResponse
    {
        $key = (string) env('VAPID_PUBLIC_KEY', '');

        return response()->json([
            'publicKey' => $key,
            'configured' => $key !== '',
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => ['required', 'string'],
            'p256dh' => ['required', 'string'],
            'auth' => ['required', 'string'],
            'user_agent' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! Schema::hasTable('push_subscriptions')) {
            return response()->json(['message' => 'push_subscriptions table not found'], 422);
        }

        $payload = [
            'user_id' => $request->user()->id,
            'endpoint' => $validated['endpoint'],
            'p256dh' => $validated['p256dh'],
            'auth' => $validated['auth'],
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('push_subscriptions', 'user_agent')) {
            $payload['user_agent'] = $validated['user_agent'] ?? null;
        }
        if (Schema::hasColumn('push_subscriptions', 'last_seen_at')) {
            $payload['last_seen_at'] = now();
        }

        if (Schema::hasColumn('push_subscriptions', 'endpoint_hash')) {
            $payload['endpoint_hash'] = hash('sha256', $validated['endpoint']);

            $existing = DB::table('push_subscriptions')
                ->where('endpoint_hash', $payload['endpoint_hash'])
                ->exists();

            if ($existing) {
                DB::table('push_subscriptions')
                    ->where('endpoint_hash', $payload['endpoint_hash'])
                    ->update($payload);
            } else {
                DB::table('push_subscriptions')->insert($payload + ['created_at' => now()]);
            }
        } else {
            DB::table('push_subscriptions')
                ->where('endpoint', $validated['endpoint'])
                ->delete();

            DB::table('push_subscriptions')->insert($payload + ['created_at' => now()]);
        }

        return response()->json(['message' => 'Subscribed']);
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => ['required', 'string'],
        ]);

        if (! Schema::hasTable('push_subscriptions')) {
            return response()->json(['message' => 'push_subscriptions table not found'], 422);
        }

        $query = DB::table('push_subscriptions')
            ->where('user_id', $request->user()->id);

        if (Schema::hasColumn('push_subscriptions', 'endpoint_hash')) {
            $query->where('endpoint_hash', hash('sha256', $validated['endpoint']));
        } else {
            $query->where('endpoint', $validated['endpoint']);
        }

        $query->delete();

        return response()->json(['message' => 'Unsubscribed']);
    }
}
