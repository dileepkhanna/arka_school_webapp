<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('gallery_folders')) {
            Schema::create('gallery_folders', function (Blueprint $table): void {
                $table->id();
                $table->string('title');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index('created_at');
            });
        }

        if (! Schema::hasTable('gallery_images')) {
            Schema::create('gallery_images', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('folder_id');
                $table->string('image_url');
                $table->string('caption')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index('folder_id');
                $table->index('created_at');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('gallery_images');
        Schema::dropIfExists('gallery_folders');
    }
};
