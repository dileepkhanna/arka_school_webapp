<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('fee_payment_orders')) {
            return;
        }

        Schema::create('fee_payment_orders', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('fee_id');
            $table->unsignedBigInteger('student_id');
            $table->unsignedBigInteger('parent_user_id');
            $table->string('razorpay_order_id')->unique();
            $table->string('razorpay_payment_id')->nullable();
            $table->string('razorpay_signature')->nullable();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 10)->default('INR');
            $table->string('status', 20)->default('created');
            $table->text('order_payload')->nullable();
            $table->text('verification_payload')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index(['fee_id', 'parent_user_id']);
            $table->index(['student_id', 'created_at']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fee_payment_orders');
    }
};
