<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameSession extends Model
{
    protected $fillable = [
        'project_id', 'map_config_id', 'name', 'seed', 'status', 'tick', 'game_year',
        'map_width', 'map_height', 'procedural_settings', 'victory_conditions',
        'map_data', 'ecs_state', 'faction_resources',
    ];

    protected $casts = [
        'procedural_settings' => 'array',
        'victory_conditions'  => 'array',
        'faction_resources'   => 'array',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function mapConfig(): BelongsTo
    {
        return $this->belongsTo(MapConfig::class);
    }
}
