<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('homework')) {
            Schema::create('homework', function (Blueprint $table): void {
                $table->id();
                $table->string('title');
                $table->text('description')->nullable();
                $table->date('due_date');
                $table->unsignedBigInteger('class_id');
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->string('attachment_url')->nullable();
                $table->timestamps();

                $table->index(['class_id', 'due_date']);
            });
        }

        if (! Schema::hasTable('student_reports')) {
            Schema::create('student_reports', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('student_id');
                $table->string('category');
                $table->text('description');
                $table->string('severity', 30)->default('info');
                $table->boolean('parent_visible')->default(true);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index(['student_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('student_reports');
        Schema::dropIfExists('homework');
    }
};
