<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('question_papers')) {
            Schema::create('question_papers', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('exam_id');
                $table->unsignedBigInteger('class_id');
                $table->unsignedInteger('total_questions')->default(0);
                $table->unsignedInteger('total_marks')->default(0);
                $table->unsignedBigInteger('uploaded_by')->nullable();
                $table->timestamps();

                $table->index('exam_id');
                $table->index('class_id');
            });
        }

        if (! Schema::hasTable('questions')) {
            Schema::create('questions', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('question_paper_id');
                $table->unsignedInteger('question_number');
                $table->text('question_text');
                $table->string('question_type', 30)->default('short');
                $table->text('option_a')->nullable();
                $table->text('option_b')->nullable();
                $table->text('option_c')->nullable();
                $table->text('option_d')->nullable();
                $table->text('correct_answer')->nullable();
                $table->text('explanation')->nullable();
                $table->unsignedInteger('marks')->default(1);
                $table->timestamps();

                $table->index('question_paper_id');
                $table->unique(['question_paper_id', 'question_number']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
        Schema::dropIfExists('question_papers');
    }
};
