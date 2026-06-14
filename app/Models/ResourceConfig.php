<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResourceConfig extends Model
{
    protected $fillable = [
        'project_id', 'key', 'name', 'icon', 'color',
        'max_storage', 'affects_population',
    ];

    protected $casts = ['affects_population' => 'boolean'];

    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
}
