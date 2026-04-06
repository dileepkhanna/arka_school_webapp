<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('fees') || Schema::hasColumn('fees', 'assigned_class_id')) {
            return;
        }

        Schema::table('fees', function (Blueprint $table): void {
            $table->foreignId('assigned_class_id')
                ->nullable()
                ->after('student_id')
                ->constrained('classes')
                ->nullOnDelete();
            $table->index(['assigned_class_id', 'due_date']);
        });

        DB::table('fees')
            ->join('students', 'students.id', '=', 'fees.student_id')
            ->update([
                'fees.assigned_class_id' => DB::raw('students.class_id'),
            ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('fees') || ! Schema::hasColumn('fees', 'assigned_class_id')) {
            return;
        }

        Schema::table('fees', function (Blueprint $table): void {
            $table->dropForeign(['assigned_class_id']);
            $table->dropIndex('fees_assigned_class_id_due_date_index');
            $table->dropColumn('assigned_class_id');
        });
    }
};
