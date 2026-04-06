<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('notifications')) {
            Schema::table('notifications', function (Blueprint $table): void {
                if (! Schema::hasColumn('notifications', 'entity_type')) {
                    $table->string('entity_type')->nullable()->after('type');
                }
                if (! Schema::hasColumn('notifications', 'entity_id')) {
                    $table->string('entity_id')->nullable()->after('entity_type');
                }
                if (! Schema::hasColumn('notifications', 'priority')) {
                    $table->string('priority', 20)->default('normal')->after('entity_id');
                }
                if (! Schema::hasColumn('notifications', 'channel')) {
                    $table->string('channel', 20)->default('both')->after('priority');
                }
                if (! Schema::hasColumn('notifications', 'dedupe_key')) {
                    $table->string('dedupe_key')->nullable()->after('channel');
                }
                if (! Schema::hasColumn('notifications', 'meta_json')) {
                    $table->text('meta_json')->nullable()->after('dedupe_key');
                }
            });

            Schema::table('notifications', function (Blueprint $table): void {
                $table->index(['user_id', 'created_at'], 'idx_notifications_user_created_at');
                $table->index(['user_id', 'is_read'], 'idx_notifications_user_read');
                $table->index(['user_id', 'type'], 'idx_notifications_user_type');
                if (Schema::hasColumn('notifications', 'dedupe_key')) {
                    $table->index(['user_id', 'dedupe_key'], 'idx_notifications_user_dedupe');
                }
            });
        }

        if (! Schema::hasTable('notification_preferences')) {
            Schema::create('notification_preferences', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->unique();
                $table->boolean('enable_push')->default(true);
                $table->boolean('enable_in_app')->default(true);
                $table->boolean('critical_only_push')->default(false);
                $table->json('category_preferences')->nullable();
                $table->timestamps();

                $table->index('enable_push');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('notification_preferences')) {
            Schema::drop('notification_preferences');
        }

        if (Schema::hasTable('notifications')) {
            Schema::table('notifications', function (Blueprint $table): void {
                if (Schema::hasColumn('notifications', 'meta_json')) {
                    $table->dropColumn('meta_json');
                }
                if (Schema::hasColumn('notifications', 'dedupe_key')) {
                    $table->dropColumn('dedupe_key');
                }
                if (Schema::hasColumn('notifications', 'channel')) {
                    $table->dropColumn('channel');
                }
                if (Schema::hasColumn('notifications', 'priority')) {
                    $table->dropColumn('priority');
                }
                if (Schema::hasColumn('notifications', 'entity_id')) {
                    $table->dropColumn('entity_id');
                }
                if (Schema::hasColumn('notifications', 'entity_type')) {
                    $table->dropColumn('entity_type');
                }
            });
        }
    }
};
