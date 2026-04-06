<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('complaints')) {
            return;
        }

        if (! Schema::hasColumn('complaints', 'visible_to')) {
            Schema::table('complaints', function (Blueprint $table): void {
                $table->json('visible_to')->nullable()->after('submitted_by');
            });
        }

        DB::table('complaints')
            ->whereNull('visible_to')
            ->update(['visible_to' => json_encode(['admin'])]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('complaints') || ! Schema::hasColumn('complaints', 'visible_to')) {
            return;
        }

        Schema::table('complaints', function (Blueprint $table): void {
            $table->dropColumn('visible_to');
        });
    }
};
