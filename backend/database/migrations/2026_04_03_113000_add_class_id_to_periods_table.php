<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('periods') || Schema::hasColumn('periods', 'class_id')) {
            return;
        }

        Schema::table('periods', function (Blueprint $table): void {
            $table->unsignedBigInteger('class_id')->default(0)->after('id');
            $table->index(['class_id', 'period_number']);
        });

        DB::table('periods')->update(['class_id' => 0]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('periods') || ! Schema::hasColumn('periods', 'class_id')) {
            return;
        }

        Schema::table('periods', function (Blueprint $table): void {
            $table->dropIndex('periods_class_id_period_number_index');
            $table->dropColumn('class_id');
        });
    }
};
