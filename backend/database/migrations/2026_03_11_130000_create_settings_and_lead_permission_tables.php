<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('app_settings')) {
            Schema::create('app_settings', function (Blueprint $table): void {
                $table->id();
                $table->string('setting_key')->unique();
                $table->text('setting_value')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('teacher_lead_permissions')) {
            Schema::create('teacher_lead_permissions', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('teacher_id')->unique();
                $table->boolean('enabled')->default(false);
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();

                $table->index('enabled');
            });
        }

        if (! Schema::hasTable('settings_audit_log')) {
            Schema::create('settings_audit_log', function (Blueprint $table): void {
                $table->id();
                $table->string('setting_key');
                $table->text('old_value')->nullable();
                $table->text('new_value')->nullable();
                $table->unsignedBigInteger('changed_by')->nullable();
                $table->timestamps();

                $table->index(['setting_key', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('settings_audit_log');
        Schema::dropIfExists('teacher_lead_permissions');
        Schema::dropIfExists('app_settings');
    }
};
