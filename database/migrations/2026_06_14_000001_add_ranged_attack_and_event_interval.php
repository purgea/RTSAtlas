<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('unit_configs', function (Blueprint $table) {
            $table->boolean('ranged_attack')->default(false)->after('range');
        });

        Schema::table('event_configs', function (Blueprint $table) {
            $table->integer('interval_seconds')->default(300)->after('base_probability');
        });
    }

    public function down(): void
    {
        Schema::table('event_configs', function (Blueprint $table) {
            $table->dropColumn('interval_seconds');
        });

        Schema::table('unit_configs', function (Blueprint $table) {
            $table->dropColumn('ranged_attack');
        });
    }
};
