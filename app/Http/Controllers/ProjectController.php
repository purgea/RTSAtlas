<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\Faction;
use App\Models\UnitConfig;
use App\Models\BuildingConfig;
use App\Models\TechConfig;
use App\Models\EventConfig;
use App\Models\ResourceConfig;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProjectController extends Controller
{
    public function index()
    {
        $projects = Project::withCount(['factions', 'gameSessions'])
            ->orderByDesc('updated_at')
            ->get();

        return Inertia::render('Welcome', ['projects' => $projects]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:120',
            'description' => 'nullable|string|max:500',
            'settings'    => 'nullable|array',
        ]);

        $project = Project::create(array_merge($validated, [
            'settings' => $validated['settings'] ?? $this->defaultSettings(),
        ]));

        $this->seedDefaultData($project);

        return redirect()->route('editor.index', $project);
    }

    public function editor(Project $project)
    {
        $project->load([
            'factions',
            'unitConfigs',
            'buildingConfigs',
            'techConfigs',
            'eventConfigs',
            'resourceConfigs',
        ]);

        return Inertia::render('Editor/Index', ['project' => $project]);
    }

    public function update(Request $request, Project $project)
    {
        $validated = $request->validate([
            'name'        => 'sometimes|string|max:120',
            'description' => 'nullable|string|max:500',
            'settings'    => 'nullable|array',
        ]);

        $project->update($validated);

        return response()->json($project);
    }

    public function destroy(Project $project)
    {
        $project->delete();
        return redirect()->route('home');
    }

    // -------------------------------------------------------
    // Faction CRUD
    // -------------------------------------------------------

    public function storeFaction(Request $request, Project $project)
    {
        $data = $request->validate([
            'name'       => 'required|string|max:80',
            'color'      => 'required|string|max:7',
            'emblem'     => 'nullable|string|max:120',
            'description'=> 'nullable|string',
            'bonuses'    => 'nullable|array',
            'ai_profile' => 'nullable|array',
            'playable'   => 'boolean',
        ]);

        return response()->json($project->factions()->create($data), 201);
    }

    public function updateFaction(Request $request, Project $project, Faction $faction)
    {
        $data = $request->validate([
            'name'       => 'sometimes|string|max:80',
            'color'      => 'sometimes|string|max:7',
            'emblem'     => 'nullable|string|max:120',
            'description'=> 'nullable|string',
            'bonuses'    => 'nullable|array',
            'ai_profile' => 'nullable|array',
            'playable'   => 'boolean',
        ]);

        $faction->update($data);
        return response()->json($faction);
    }

    public function destroyFaction(Project $project, Faction $faction)
    {
        $faction->delete();
        return response()->json(['ok' => true]);
    }

    // -------------------------------------------------------
    // Unit CRUD
    // -------------------------------------------------------

    public function storeUnit(Request $request, Project $project)
    {
        $data = $request->validate([
            'faction_id'    => 'nullable|exists:factions,id',
            'key'           => 'required|string|max:60',
            'name'          => 'required|string|max:80',
            'category'      => 'required|string',
            'health'        => 'integer|min:1',
            'damage'        => 'integer|min:0',
            'armor'         => 'integer|min:0',
            'speed'         => 'numeric|min:0.1',
            'range'         => 'integer|min:1',
            'ranged_attack' => 'boolean',
            'sight'         => 'integer|min:1',
            'cost'          => 'nullable|array',
            'training_time' => 'integer|min:1',
            'requirements'  => 'nullable|array',
            'abilities'     => 'nullable|array',
            'sprite'        => 'nullable|string|max:120',
            'color'         => 'nullable|string|max:7',
        ]);

        return response()->json($project->unitConfigs()->create($data), 201);
    }

    public function updateUnit(Request $request, Project $project, UnitConfig $unit)
    {
        $data = $request->validate([
            'key'           => 'sometimes|string|max:60',
            'name'          => 'sometimes|string|max:80',
            'category'      => 'sometimes|string',
            'health'        => 'integer|min:1',
            'damage'        => 'integer|min:0',
            'armor'         => 'integer|min:0',
            'speed'         => 'numeric|min:0.1',
            'range'         => 'integer|min:1',
            'ranged_attack' => 'boolean',
            'sight'         => 'integer|min:1',
            'cost'          => 'nullable|array',
            'training_time' => 'integer|min:1',
            'requirements'  => 'nullable|array',
            'abilities'     => 'nullable|array',
            'sprite'        => 'nullable|string|max:120',
            'color'         => 'nullable|string|max:7',
        ]);

        $unit->update($data);
        return response()->json($unit);
    }

    public function destroyUnit(Project $project, UnitConfig $unit)
    {
        $unit->delete();
        return response()->json(['ok' => true]);
    }

    // -------------------------------------------------------
    // Building CRUD
    // -------------------------------------------------------

    public function storeBuilding(Request $request, Project $project)
    {
        $data = $request->validate([
            'faction_id'  => 'nullable|exists:factions,id',
            'key'         => 'required|string|max:60',
            'name'        => 'required|string|max:80',
            'category'    => 'required|string',
            'health'      => 'integer|min:1',
            'armor'       => 'integer|min:0',
            'size'        => 'integer|min:1|max:4',
            'cost'        => 'nullable|array',
            'build_time'  => 'integer|min:1',
            'production'  => 'nullable|array',
            'requirements'=> 'nullable|array',
            'provides'    => 'nullable|array',
            'trains'      => 'nullable|array',
            'sprite'      => 'nullable|string|max:120',
            'color'       => 'nullable|string|max:7',
        ]);

        return response()->json($project->buildingConfigs()->create($data), 201);
    }

    public function updateBuilding(Request $request, Project $project, BuildingConfig $building)
    {
        $data = $request->validate([
            'key'         => 'sometimes|string|max:60',
            'name'        => 'sometimes|string|max:80',
            'category'    => 'sometimes|string',
            'health'      => 'integer|min:1',
            'armor'       => 'integer|min:0',
            'size'        => 'integer|min:1|max:4',
            'cost'        => 'nullable|array',
            'build_time'  => 'integer|min:1',
            'production'  => 'nullable|array',
            'requirements'=> 'nullable|array',
            'provides'    => 'nullable|array',
            'trains'      => 'nullable|array',
            'sprite'      => 'nullable|string|max:120',
            'color'       => 'nullable|string|max:7',
        ]);

        $building->update($data);
        return response()->json($building);
    }

    public function destroyBuilding(Project $project, BuildingConfig $building)
    {
        $building->delete();
        return response()->json(['ok' => true]);
    }

    // -------------------------------------------------------
    // Tech CRUD
    // -------------------------------------------------------

    public function storeTech(Request $request, Project $project)
    {
        $data = $request->validate([
            'faction_id'    => 'nullable|exists:factions,id',
            'key'           => 'required|string|max:60',
            'name'          => 'required|string|max:80',
            'era'           => 'required|string',
            'description'   => 'nullable|string',
            'cost'          => 'nullable|array',
            'research_time' => 'integer|min:1',
            'requirements'  => 'nullable|array',
            'effects'       => 'nullable|array',
            'tree_x'        => 'integer',
            'tree_y'        => 'integer',
        ]);

        return response()->json($project->techConfigs()->create($data), 201);
    }

    public function updateTech(Request $request, Project $project, TechConfig $tech)
    {
        $data = $request->validate([
            'key'           => 'sometimes|string|max:60',
            'name'          => 'sometimes|string|max:80',
            'era'           => 'sometimes|string',
            'description'   => 'nullable|string',
            'cost'          => 'nullable|array',
            'research_time' => 'integer|min:1',
            'requirements'  => 'nullable|array',
            'effects'       => 'nullable|array',
            'tree_x'        => 'integer',
            'tree_y'        => 'integer',
        ]);

        $tech->update($data);
        return response()->json($tech);
    }

    public function destroyTech(Project $project, TechConfig $tech)
    {
        $tech->delete();
        return response()->json(['ok' => true]);
    }

    // -------------------------------------------------------
    // Event CRUD
    // -------------------------------------------------------

    public function storeEvent(Request $request, Project $project)
    {
        $data = $request->validate([
            'key'              => 'required|string|max:60',
            'name'             => 'required|string|max:80',
            'type'             => 'required|string',
            'description'      => 'nullable|string',
            'interval_seconds' => 'integer|min:1',
            'conditions'       => 'nullable|array',
            'effects'          => 'nullable|array',
            'choices'          => 'nullable|array',
            'duration'         => 'integer|min:0',
        ]);

        return response()->json($project->eventConfigs()->create($data), 201);
    }

    public function updateEvent(Request $request, Project $project, EventConfig $event)
    {
        $data = $request->validate([
            'key'              => 'sometimes|string|max:60',
            'name'             => 'sometimes|string|max:80',
            'type'             => 'sometimes|string',
            'description'      => 'nullable|string',
            'interval_seconds' => 'integer|min:1',
            'conditions'       => 'nullable|array',
            'effects'          => 'nullable|array',
            'choices'          => 'nullable|array',
            'duration'         => 'integer|min:0',
        ]);

        $event->update($data);
        return response()->json($event);
    }

    public function destroyEvent(Project $project, EventConfig $event)
    {
        $event->delete();
        return response()->json(['ok' => true]);
    }

    // -------------------------------------------------------
    // Resource CRUD
    // -------------------------------------------------------

    public function updateResource(Request $request, Project $project, ResourceConfig $resource)
    {
        $data = $request->validate([
            'key'                => 'sometimes|string|max:60',
            'name'               => 'sometimes|string|max:80',
            'icon'               => 'nullable|string|max:120',
            'color'              => 'sometimes|string|max:7',
            'max_storage'        => 'integer|min:1',
            'affects_population' => 'boolean',
        ]);

        $resource->update($data);
        return response()->json($resource);
    }

    // -------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------

    private function defaultSettings(): array
    {
        return [
            'map_width'          => 128,
            'map_height'         => 128,
            'starting_resources' => ['gold' => 500, 'food' => 200, 'wood' => 300, 'stone' => 100],
            'victory_conditions' => ['wealth', 'military', 'territory'],
            'max_players'        => 4,
            'game_speed'         => 1.0,
        ];
    }

    private function seedDefaultData(Project $project): void
    {
        // Default resources
        $resources = [
            ['key' => 'gold',     'name' => 'Gold',     'color' => '#ffd700', 'max_storage' => 99999, 'affects_population' => false],
            ['key' => 'food',     'name' => 'Food',     'color' => '#7ec850', 'max_storage' => 9999,  'affects_population' => true],
            ['key' => 'wood',     'name' => 'Wood',     'color' => '#8B4513', 'max_storage' => 9999,  'affects_population' => false],
            ['key' => 'stone',    'name' => 'Stone',    'color' => '#a0a0a0', 'max_storage' => 9999,  'affects_population' => false],
            ['key' => 'iron',     'name' => 'Iron',     'color' => '#708090', 'max_storage' => 9999,  'affects_population' => false],
            ['key' => 'faith',    'name' => 'Faith',    'color' => '#e0c0ff', 'max_storage' => 9999,  'affects_population' => false],
            ['key' => 'prestige', 'name' => 'Prestige', 'color' => '#ff8c00', 'max_storage' => 99999, 'affects_population' => false],
        ];
        foreach ($resources as $r) {
            $project->resourceConfigs()->create($r);
        }

        // Default faction
        $faction = $project->factions()->create([
            'name'    => 'Kingdom',
            'color'   => '#4169e1',
            'description' => 'The default player faction',
            'bonuses' => [],
            'ai_profile' => ['aggression' => 0.5, 'expansion' => 0.6, 'economy' => 0.7],
            'playable' => true,
        ]);

        // AI faction
        $project->factions()->create([
            'name'    => 'Empire',
            'color'   => '#cc2222',
            'description' => 'An aggressive AI faction',
            'bonuses' => ['military' => 0.2],
            'ai_profile' => ['aggression' => 0.8, 'expansion' => 0.7, 'economy' => 0.5],
            'playable' => false,
        ]);
    }
}
