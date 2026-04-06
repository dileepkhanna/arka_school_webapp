<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('push_subscriptions')) {
            return;
        }

        Schema::table('push_subscriptions', function (Blueprint $table): void {
            if (! Schema::hasColumn('push_subscriptions', 'endpoint_hash')) {
                $table->char('endpoint_hash', 64)->nullable()->after('endpoint');
            }
            if (! Schema::hasColumn('push_subscriptions', 'user_agent')) {
                $table->string('user_agent', 1000)->nullable()->after('auth');
            }
            if (! Schema::hasColumn('push_subscriptions', 'last_seen_at')) {
                $table->timestamp('last_seen_at')->nullable()->after('user_agent');
            }
        });

        $rows = DB::table('push_subscriptions')
            ->select('id', 'endpoint')
            ->orderBy('id')
            ->get();

        foreach ($rows as $row) {
            DB::table('push_subscriptions')
                ->where('id', $row->id)
                ->update(['endpoint_hash' => hash('sha256', (string) $row->endpoint)]);
        }

        $duplicates = DB::table('push_subscriptions')
            ->select('endpoint_hash')
            ->whereNotNull('endpoint_hash')
            ->groupBy('endpoint_hash')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('endpoint_hash');

        foreach ($duplicates as $endpointHash) {
            $records = DB::table('push_subscriptions')
                ->where('endpoint_hash', $endpointHash)
                ->orderByDesc('updated_at')
                ->orderByDesc('id')
                ->get(['id']);

            $keepId = $records->first()?->id;
            if (! $keepId) {
                continue;
            }

            DB::table('push_subscriptions')
                ->where('endpoint_hash', $endpointHash)
                ->where('id', '!=', $keepId)
                ->delete();
        }

        Schema::table('push_subscriptions', function (Blueprint $table): void {
            if (Schema::hasColumn('push_subscriptions', 'endpoint_hash')) {
                $table->unique('endpoint_hash', 'push_subscriptions_endpoint_hash_unique');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('push_subscriptions')) {
            return;
        }

        Schema::table('push_subscriptions', function (Blueprint $table): void {
            $sm = Schema::getConnection()->getSchemaBuilder();

            if ($sm->hasColumn('push_subscriptions', 'endpoint_hash')) {
                $table->dropUnique('push_subscriptions_endpoint_hash_unique');
                $table->dropColumn('endpoint_hash');
            }
            if ($sm->hasColumn('push_subscriptions', 'user_agent')) {
                $table->dropColumn('user_agent');
            }
            if ($sm->hasColumn('push_subscriptions', 'last_seen_at')) {
                $table->dropColumn('last_seen_at');
            }
        });
    }
};
