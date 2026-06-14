<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EventConfig extends Model
{
    protected $fillable = [
        'project_id', 'key', 'name', 'type', 'description',
        'base_probability', 'conditions', 'effects', 'choices', 'duration',
    ];

    protected $casts = [
        'conditions' => 'array', 'effects' => 'array', 'choices' => 'array',
    ];

    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
}
