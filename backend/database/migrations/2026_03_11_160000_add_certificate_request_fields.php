<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('certificate_requests')) {
            return;
        }

        Schema::table('certificate_requests', function (Blueprint $table): void {
            if (! Schema::hasColumn('certificate_requests', 'description')) {
                $table->text('description')->nullable()->after('certificate_type');
            }

            if (! Schema::hasColumn('certificate_requests', 'admin_remarks')) {
                $table->text('admin_remarks')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('certificate_requests')) {
            return;
        }

        Schema::table('certificate_requests', function (Blueprint $table): void {
            if (Schema::hasColumn('certificate_requests', 'admin_remarks')) {
                $table->dropColumn('admin_remarks');
            }
            if (Schema::hasColumn('certificate_requests', 'description')) {
                $table->dropColumn('description');
            }
        });
    }
};
