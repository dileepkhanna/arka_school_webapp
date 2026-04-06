<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotion_history', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('student_id')
                  ->constrained('students')
                  ->cascadeOnDelete();

            $table->foreignId('from_class_id')
                  ->nullable()
                  ->constrained('classes')
                  ->nullOnDelete();

            $table->foreignId('to_class_id')
                  ->nullable()
                  ->constrained('classes')
                  ->nullOnDelete();

            $table->string('academic_year', 20);
            $table->unsignedBigInteger('promoted_by');
            $table->timestamps();

            $table->index('student_id');
            $table->index('academic_year');
            $table->index(['from_class_id', 'to_class_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_history');
    }
};
