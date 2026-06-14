<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Casts\AsArrayObject;

class Project extends Model
{
    protected $fillable = ['name', 'description', 'version', 'settings'];

    protected $casts = [
        'settings' => 'array',
    ];

    public function factions(): HasMany
    {
        return $this->hasMany(Faction::class);
    }

    public function unitConfigs(): HasMany
    {
        return $this->hasMany(UnitConfig::class);
    }

    public function buildingConfigs(): HasMany
    {
        return $this->hasMany(BuildingConfig::class);
    }

    public function techConfigs(): HasMany
    {
        return $this->hasMany(TechConfig::class);
    }

    public function eventConfigs(): HasMany
    {
        return $this->hasMany(EventConfig::class);
    }

    public function resourceConfigs(): HasMany
    {
        return $this->hasMany(ResourceConfig::class);
    }

    public function gameSessions(): HasMany
    {
        return $this->hasMany(GameSession::class);
    }
}
