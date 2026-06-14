<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UnitConfig extends Model
{
    protected $fillable = [
        'project_id', 'faction_id', 'key', 'name', 'category',
        'health', 'damage', 'armor', 'speed', 'range', 'ranged_attack', 'sight',
        'cost', 'training_time', 'requirements', 'abilities', 'sprite', 'color',
    ];

    protected $casts = [
        'cost' => 'array', 'requirements' => 'array', 'abilities' => 'array',
        'ranged_attack' => 'boolean',
    ];

    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function faction(): BelongsTo { return $this->belongsTo(Faction::class); }
}
