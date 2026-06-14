<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('version')->default('1.0.0');
            $table->json('settings')->nullable(); // map size, victory conditions, etc.
            $table->timestamps();
        });

        Schema::create('factions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color', 7)->default('#ff0000');
            $table->string('emblem')->nullable();
            $table->text('description')->nullable();
            $table->json('bonuses')->nullable();       // economy/military modifiers
            $table->json('ai_profile')->nullable();    // ai personality config
            $table->boolean('playable')->default(true);
            $table->timestamps();
        });

        Schema::create('unit_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('faction_id')->nullable()->constrained()->nullOnDelete();
            $table->string('key')->index();            // e.g. 'soldier', 'archer'
            $table->string('name');
            $table->string('category');               // military, civilian, siege
            $table->integer('health')->default(100);
            $table->integer('damage')->default(10);
            $table->integer('armor')->default(0);
            $table->float('speed')->default(1.5);
            $table->integer('range')->default(1);     // 1 = melee
            $table->integer('sight')->default(5);
            $table->json('cost')->nullable();         // resource costs {gold:50, food:1}
            $table->integer('training_time')->default(30); // seconds
            $table->json('requirements')->nullable();  // tech/building requirements
            $table->json('abilities')->nullable();     // special abilities
            $table->string('sprite')->nullable();
            $table->string('color', 7)->nullable();
            $table->timestamps();
        });

        Schema::create('building_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('faction_id')->nullable()->constrained()->nullOnDelete();
            $table->string('key')->index();
            $table->string('name');
            $table->string('category');               // military, economy, civic, production
            $table->integer('health')->default(500);
            $table->integer('armor')->default(5);
            $table->integer('size')->default(1);      // footprint in tiles (1=1x1, 2=2x2)
            $table->json('cost')->nullable();
            $table->integer('build_time')->default(60);
            $table->json('production')->nullable();    // what it produces per tick
            $table->json('requirements')->nullable();
            $table->json('provides')->nullable();      // services (sanitation, faith, etc.)
            $table->json('trains')->nullable();        // unit keys it can train
            $table->string('sprite')->nullable();
            $table->string('color', 7)->nullable();
            $table->timestamps();
        });

        Schema::create('tech_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('faction_id')->nullable()->constrained()->nullOnDelete();
            $table->string('key')->index();
            $table->string('name');
            $table->string('era')->default('medieval');  // ancient, medieval, renaissance
            $table->text('description')->nullable();
            $table->json('cost')->nullable();
            $table->integer('research_time')->default(120);
            $table->json('requirements')->nullable();    // prerequisite tech keys
            $table->json('effects')->nullable();         // what it unlocks/modifies
            $table->integer('tree_x')->default(0);      // position in tech tree UI
            $table->integer('tree_y')->default(0);
            $table->timestamps();
        });

        Schema::create('event_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('key')->index();
            $table->string('name');
            $table->string('type');                      // disaster, opportunity, political, etc.
            $table->text('description')->nullable();
            $table->float('base_probability')->default(0.01); // per game-year
            $table->json('conditions')->nullable();      // when it can trigger
            $table->json('effects')->nullable();         // what it does
            $table->json('choices')->nullable();         // player choices and consequences
            $table->integer('duration')->default(0);     // 0 = instant, >0 = lasts N ticks
            $table->timestamps();
        });

        Schema::create('resource_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('key')->index();
            $table->string('name');
            $table->string('icon')->nullable();
            $table->string('color', 7)->default('#ffd700');
            $table->integer('max_storage')->default(9999);
            $table->boolean('affects_population')->default(false);
            $table->timestamps();
        });

        Schema::create('game_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedBigInteger('seed');
            $table->string('status')->default('active');  // active, paused, victory, defeat
            $table->integer('tick')->default(0);
            $table->integer('game_year')->default(1);
            $table->integer('map_width')->default(128);
            $table->integer('map_height')->default(128);
            $table->json('procedural_settings')->nullable();
            $table->json('victory_conditions')->nullable();
            $table->longText('map_data')->nullable();      // serialized tile array (compressed)
            $table->longText('ecs_state')->nullable();     // full ECS snapshot
            $table->json('faction_resources')->nullable(); // per-faction resource totals
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_sessions');
        Schema::dropIfExists('resource_configs');
        Schema::dropIfExists('event_configs');
        Schema::dropIfExists('tech_configs');
        Schema::dropIfExists('building_configs');
        Schema::dropIfExists('unit_configs');
        Schema::dropIfExists('factions');
        Schema::dropIfExists('projects');
    }
};
