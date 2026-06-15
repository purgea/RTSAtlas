<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('map_configs', function (Blueprint $table) {
            $table->string('music_path')->nullable()->after('procedural_settings');
            $table->string('music_name')->nullable()->after('music_path');
        });
    }

    public function down(): void
    {
        Schema::table('map_configs', function (Blueprint $table) {
            $table->dropColumn(['music_path', 'music_name']);
        });
    }
};
