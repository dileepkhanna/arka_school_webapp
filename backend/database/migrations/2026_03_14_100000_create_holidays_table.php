<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('holidays')) {
            Schema::create('holidays', function (Blueprint $table): void {
                $table->id();
                $table->string('name', 255);
                $table->enum('type', ['national', 'religious', 'school', 'optional']);
                $table->date('start_date');
                $table->date('end_date')->nullable();
                $table->text('description')->nullable();
                $table->string('image_url', 2048)->nullable();
                $table->boolean('is_recurring')->default(false);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index(['start_date', 'end_date']);
                $table->index('is_recurring');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('holidays');
    }
};
