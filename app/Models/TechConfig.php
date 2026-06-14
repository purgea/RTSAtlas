<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TechConfig extends Model
{
    protected $fillable = [
        'project_id', 'faction_id', 'key', 'name', 'era', 'description',
        'cost', 'research_time', 'requirements', 'effects', 'tree_x', 'tree_y',
    ];

    protected $casts = [
        'cost' => 'array', 'requirements' => 'array', 'effects' => 'array',
    ];

    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function faction(): BelongsTo { return $this->belongsTo(Faction::class); }
}
