<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\Faction;
use App\Models\UnitConfig;
use App\Models\BuildingConfig;
use App\Models\TechConfig;
use App\Models\EventConfig;
use App\Models\ResourceConfig;
use App\Models\MapConfig;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class ProjectController extends Controller
{
    public function index()
    {
        $projects = Project::withCount(['factions', 'gameSessions'])
            ->with('mapConfigs')
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
            'mapConfigs',
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
    // Map preset CRUD
    // -------------------------------------------------------

    public function storeMap(Request $request, Project $project)
    {
        $this->normalizeMapRequest($request);
        $data = $request->validate($this->mapValidationRules(true));
        $this->storeMapMusic($request, $data);

        if ($data['is_default'] ?? false) {
            $project->mapConfigs()->update(['is_default' => false]);
        }

        return response()->json($project->mapConfigs()->create($data), 201);
    }

    public function updateMap(Request $request, Project $project, MapConfig $map)
    {
        $this->normalizeMapRequest($request);
        $data = $request->validate($this->mapValidationRules(false));
        $this->storeMapMusic($request, $data, $map);

        if ($data['is_default'] ?? false) {
            $project->mapConfigs()->where('id', '!=', $map->id)->update(['is_default' => false]);
        }

        $map->update($data);
        return response()->json($map);
    }

    public function destroyMap(Project $project, MapConfig $map)
    {
        $wasDefault = $map->is_default;
        if ($map->music_path) {
            Storage::disk('public')->delete($map->music_path);
        }
        $map->delete();

        if ($wasDefault) {
            $next = $project->mapConfigs()->oldest('id')->first();
            $next?->update(['is_default' => true]);
        }

        return response()->json(['ok' => true]);
    }

    public function mapMusic(Request $request, MapConfig $map)
    {
        abort_unless($map->music_path && Storage::disk('public')->exists($map->music_path), 404);

        $disk = Storage::disk('public');
        $mime = $disk->mimeType($map->music_path) ?: 'audio/mpeg';
        $size = $disk->size($map->music_path);
        $start = 0;
        $end = $size - 1;
        $status = 200;

        if ($request->headers->has('Range')) {
            $range = $request->header('Range');
            if (preg_match('/bytes=(\d*)-(\d*)/', $range, $matches)) {
                $start = $matches[1] !== '' ? (int) $matches[1] : 0;
                $end = $matches[2] !== '' ? (int) $matches[2] : $end;
                $start = max(0, min($start, $size - 1));
                $end = max($start, min($end, $size - 1));
                $status = 206;
            }
        }

        $length = $end - $start + 1;

        $headers = [
            'Content-Type' => $mime,
            'Content-Length' => (string) $length,
            'Accept-Ranges' => 'bytes',
        ];

        if ($status === 206) {
            $headers['Content-Range'] = "bytes {$start}-{$end}/{$size}";
        }

        return response()->stream(function () use ($disk, $map, $start, $length) {
            $stream = $disk->readStream($map->music_path);
            if ($start > 0) {
                fseek($stream, $start);
            }

            $remaining = $length;
            while ($remaining > 0 && !feof($stream)) {
                $chunk = fread($stream, min(8192, $remaining));
                if ($chunk === false) {
                    break;
                }
                echo $chunk;
                $remaining -= strlen($chunk);
            }

            if (is_resource($stream)) {
                fclose($stream);
            }
        }, $status, $headers);
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

    private function mapValidationRules(bool $creating): array
    {
        return [
            'key'                 => [$creating ? 'required' : 'sometimes', 'string', 'max:60'],
            'name'                => [$creating ? 'required' : 'sometimes', 'string', 'max:80'],
            'description'         => 'nullable|string',
            'width'               => 'integer|min:64|max:256',
            'height'              => 'integer|min:64|max:256',
            'max_players'         => 'integer|min:2|max:8',
            'procedural_settings' => 'nullable|array',
            'music_file'          => 'nullable|file|mimes:mp3,ogg,wav,m4a,aac,flac|max:20480',
            'remove_music'        => 'boolean',
            'is_default'          => 'boolean',
        ];
    }

    private function normalizeMapRequest(Request $request): void
    {
        $merge = [];

        if (is_string($request->input('procedural_settings'))) {
            $decoded = json_decode($request->input('procedural_settings'), true);
            $merge['procedural_settings'] = is_array($decoded) ? $decoded : [];
        }

        foreach (['is_default', 'remove_music'] as $key) {
            if ($request->has($key)) {
                $merge[$key] = filter_var($request->input($key), FILTER_VALIDATE_BOOLEAN);
            }
        }

        foreach (['width', 'height', 'max_players'] as $key) {
            if ($request->has($key)) {
                $merge[$key] = (int) $request->input($key);
            }
        }

        if ($merge) {
            $request->merge($merge);
        }
    }

    private function storeMapMusic(Request $request, array &$data, ?MapConfig $map = null): void
    {
        unset($data['music_file']);

        if ($data['remove_music'] ?? false) {
            if ($map?->music_path) {
                Storage::disk('public')->delete($map->music_path);
            }
            $data['music_path'] = null;
            $data['music_name'] = null;
        }
        unset($data['remove_music']);

        if (!$request->hasFile('music_file')) {
            return;
        }

        if ($map?->music_path) {
            Storage::disk('public')->delete($map->music_path);
        }

        $file = $request->file('music_file');
        $data['music_path'] = $file->store("map-music/project-{$request->route('project')->id}", 'public');
        $data['music_name'] = $file->getClientOriginalName();
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

        $maps = [
            [
                'key' => 'balanced_frontier',
                'name' => 'Balanced Frontier',
                'description' => 'Moderate terrain with enough open ground, ore, roads, and defensive features.',
                'width' => 128,
                'height' => 128,
                'max_players' => 4,
                'is_default' => true,
                'procedural_settings' => [
                    'scale' => 0.006,
                    'mScale' => 0.008,
                    'seaLevel' => 0.38,
                    'mountainH' => 0.72,
                    'riverCount' => 5,
                    'forestThickness' => 2,
                    'mineCount' => 8,
                    'villageCount' => 6,
                    'ruinsCount' => 7,
                    'campCount' => 5,
                    'specialCount' => 2,
                    'maxPlayers' => 4,
                ],
            ],
            [
                'key' => 'dry_highlands',
                'name' => 'Dry Highlands',
                'description' => 'Higher elevation, fewer rivers, more cliffs and concentrated ore fields.',
                'width' => 128,
                'height' => 128,
                'max_players' => 4,
                'is_default' => false,
                'procedural_settings' => [
                    'scale' => 0.007,
                    'mScale' => 0.006,
                    'seaLevel' => 0.32,
                    'mountainH' => 0.66,
                    'riverCount' => 2,
                    'forestThickness' => 1,
                    'mineCount' => 10,
                    'villageCount' => 4,
                    'ruinsCount' => 9,
                    'campCount' => 4,
                    'specialCount' => 2,
                    'maxPlayers' => 4,
                ],
            ],
            [
                'key' => 'wet_lowlands',
                'name' => 'Wet Lowlands',
                'description' => 'Lower terrain with more water, rivers, forests, and choke points.',
                'width' => 96,
                'height' => 96,
                'max_players' => 4,
                'is_default' => false,
                'procedural_settings' => [
                    'scale' => 0.005,
                    'mScale' => 0.010,
                    'seaLevel' => 0.44,
                    'mountainH' => 0.78,
                    'riverCount' => 6,
                    'forestThickness' => 3,
                    'mineCount' => 6,
                    'villageCount' => 7,
                    'ruinsCount' => 5,
                    'campCount' => 6,
                    'specialCount' => 1,
                    'maxPlayers' => 4,
                ],
            ],
        ];

        foreach ($maps as $map) {
            $project->mapConfigs()->create($map);
        }
    }
}
