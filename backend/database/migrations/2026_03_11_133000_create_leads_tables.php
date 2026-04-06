<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('leads')) {
            Schema::create('leads', function (Blueprint $table): void {
                $table->id();
                $table->string('student_name');
                $table->string('gender', 20)->nullable();
                $table->date('date_of_birth')->nullable();
                $table->string('current_class')->nullable();
                $table->string('class_applying_for')->nullable();
                $table->string('academic_year')->nullable();

                $table->string('father_name')->nullable();
                $table->string('mother_name')->nullable();
                $table->string('primary_contact_person')->nullable();
                $table->string('primary_mobile')->nullable();
                $table->string('alternate_mobile')->nullable();
                $table->string('email')->nullable();
                $table->text('address')->nullable();
                $table->string('area_city')->nullable();

                $table->string('father_education')->nullable();
                $table->string('mother_education')->nullable();
                $table->string('father_occupation')->nullable();
                $table->string('mother_occupation')->nullable();
                $table->string('annual_income_range')->nullable();

                $table->string('previous_school')->nullable();
                $table->string('education_board')->nullable();
                $table->string('medium_of_instruction')->nullable();
                $table->string('last_class_passed')->nullable();
                $table->text('academic_performance')->nullable();

                $table->string('status', 50)->default('new_lead');
                $table->date('next_followup_date')->nullable();
                $table->text('remarks')->nullable();
                $table->unsignedBigInteger('assigned_teacher_id')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index('status');
                $table->index('primary_mobile');
                $table->index('class_applying_for');
                $table->index('created_by');
                $table->index('assigned_teacher_id');
                $table->index('next_followup_date');
            });
        }

        if (! Schema::hasTable('lead_call_logs')) {
            Schema::create('lead_call_logs', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('lead_id');
                $table->unsignedBigInteger('called_by')->nullable();
                $table->string('call_outcome', 50);
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index('lead_id');
            });
        }

        if (! Schema::hasTable('lead_status_history')) {
            Schema::create('lead_status_history', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('lead_id');
                $table->string('old_status', 50)->nullable();
                $table->string('new_status', 50);
                $table->unsignedBigInteger('changed_by')->nullable();
                $table->text('remarks')->nullable();
                $table->timestamps();

                $table->index('lead_id');
                $table->index('new_status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_status_history');
        Schema::dropIfExists('lead_call_logs');
        Schema::dropIfExists('leads');
    }
};
