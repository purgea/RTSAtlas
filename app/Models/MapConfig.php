<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MapConfig extends Model
{
    protected $fillable = [
        'project_id', 'key', 'name', 'description', 'width', 'height',
        'max_players', 'procedural_settings', 'music_path', 'music_name', 'is_default',
    ];

    protected $appends = ['music_url'];

    protected $casts = [
        'procedural_settings' => 'array',
        'is_default'          => 'boolean',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function getMusicUrlAttribute(): ?string
    {
        return $this->music_path ? route('maps.music', $this) . '?v=' . md5($this->music_path) : null;
    }
}
