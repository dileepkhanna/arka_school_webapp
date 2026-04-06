<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('fees')) {
            Schema::create('fees', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
                $table->string('fee_type');
                $table->decimal('amount', 10, 2)->default(0);
                $table->decimal('discount', 10, 2)->default(0);
                $table->decimal('paid_amount', 10, 2)->default(0);
                $table->date('due_date');
                $table->string('payment_status', 20)->default('unpaid');
                $table->unsignedInteger('reminder_days_before')->default(0);
                $table->timestamp('paid_at')->nullable();
                $table->string('receipt_number')->nullable();
                $table->timestamps();

                $table->index(['student_id', 'due_date']);
                $table->index('payment_status');
            });
        }

        if (! Schema::hasTable('fee_payments')) {
            Schema::create('fee_payments', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('fee_id')->constrained('fees')->cascadeOnDelete();
                $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
                $table->decimal('amount', 10, 2);
                $table->string('payment_method', 50)->default('cash');
                $table->string('receipt_number')->nullable();
                $table->timestamp('paid_at')->nullable();
                $table->unsignedBigInteger('recorded_by')->nullable();
                $table->timestamps();

                $table->index(['student_id', 'paid_at']);
                $table->index('fee_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('fee_payments');
        Schema::dropIfExists('fees');
    }
};
