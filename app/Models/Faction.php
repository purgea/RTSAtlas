<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Faction extends Model
{
    protected $fillable = [
        'project_id', 'name', 'color', 'emblem', 'description',
        'bonuses', 'ai_profile', 'playable',
    ];

    protected $casts = [
        'bonuses'    => 'array',
        'ai_profile' => 'array',
        'playable'   => 'boolean',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(UnitConfig::class);
    }

    public function buildings(): HasMany
    {
        return $this->hasMany(BuildingConfig::class);
    }
}
