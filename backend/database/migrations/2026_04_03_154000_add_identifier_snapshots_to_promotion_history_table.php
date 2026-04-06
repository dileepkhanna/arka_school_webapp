<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('promotion_history')) {
            return;
        }

        Schema::table('promotion_history', function (Blueprint $table): void {
            if (! Schema::hasColumn('promotion_history', 'from_admission_number')) {
                $table->string('from_admission_number')->nullable()->after('to_class_id');
            }

            if (! Schema::hasColumn('promotion_history', 'to_admission_number')) {
                $table->string('to_admission_number')->nullable()->after('from_admission_number');
            }

            if (! Schema::hasColumn('promotion_history', 'from_login_id')) {
                $table->string('from_login_id')->nullable()->after('to_admission_number');
            }

            if (! Schema::hasColumn('promotion_history', 'to_login_id')) {
                $table->string('to_login_id')->nullable()->after('from_login_id');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('promotion_history')) {
            return;
        }

        Schema::table('promotion_history', function (Blueprint $table): void {
            $dropColumns = [];

            foreach (['from_admission_number', 'to_admission_number', 'from_login_id', 'to_login_id'] as $column) {
                if (Schema::hasColumn('promotion_history', $column)) {
                    $dropColumns[] = $column;
                }
            }

            if ($dropColumns !== []) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};
