<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('holidays') && ! Schema::hasColumn('holidays', 'created_by')) {
            Schema::table('holidays', function (Blueprint $table): void {
                $table->unsignedBigInteger('created_by')->nullable()->after('is_recurring');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('holidays', 'created_by')) {
            Schema::table('holidays', function (Blueprint $table): void {
                $table->dropColumn('created_by');
            });
        }
    }
};
