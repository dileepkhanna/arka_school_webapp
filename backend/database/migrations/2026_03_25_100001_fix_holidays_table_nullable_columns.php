<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('holidays')) {
            return;
        }

        Schema::table('holidays', function (Blueprint $table): void {
            // Make academic_year nullable so inserts without it don't fail
            if (Schema::hasColumn('holidays', 'academic_year')) {
                $table->string('academic_year')->nullable()->default(null)->change();
            }
        });
    }

    public function down(): void
    {
        // No rollback needed
    }
};
