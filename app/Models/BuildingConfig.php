<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BuildingConfig extends Model
{
    protected $fillable = [
        'project_id', 'faction_id', 'key', 'name', 'category',
        'health', 'armor', 'size', 'cost', 'build_time',
        'production', 'requirements', 'provides', 'trains', 'sprite', 'color',
    ];

    protected $casts = [
        'cost' => 'array', 'production' => 'array',
        'requirements' => 'array', 'provides' => 'array', 'trains' => 'array',
    ];

    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function faction(): BelongsTo { return $this->belongsTo(Faction::class); }
}
