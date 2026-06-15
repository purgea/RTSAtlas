<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('map_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('key')->index();
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('width')->default(128);
            $table->integer('height')->default(128);
            $table->integer('max_players')->default(4);
            $table->json('procedural_settings')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::table('game_sessions', function (Blueprint $table) {
            $table->foreignId('map_config_id')->nullable()->after('project_id')->constrained('map_configs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('game_sessions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('map_config_id');
        });

        Schema::dropIfExists('map_configs');
    }
};
