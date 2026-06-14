<?php

namespace App\Http\Controllers;

use App\Models\GameSession;
use App\Models\Project;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GameController extends Controller
{
    public function create(Request $request, Project $project)
    {
        $data = $request->validate([
            'name'                 => 'required|string|max:120',
            'seed'                 => 'nullable|integer',
            'map_width'            => 'integer|min:64|max:256',
            'map_height'           => 'integer|min:64|max:256',
            'procedural_settings'  => 'nullable|array',
            'victory_conditions'   => 'nullable|array',
        ]);

        $data['seed']   = $data['seed'] ?? random_int(1, PHP_INT_MAX);
        $data['status'] = 'active';

        $session = $project->gameSessions()->create($data);

        return redirect()->route('game.play', $session);
    }

    public function play(GameSession $session)
    {
        $session->load('project.factions', 'project.unitConfigs', 'project.buildingConfigs',
                        'project.techConfigs', 'project.eventConfigs', 'project.resourceConfigs');

        return Inertia::render('Game/Index', ['session' => $session]);
    }

    public function save(Request $request, GameSession $session)
    {
        $data = $request->validate([
            'tick'              => 'required|integer',
            'game_year'         => 'required|integer',
            'map_data'          => 'nullable|string',
            'ecs_state'         => 'nullable|string',
            'faction_resources' => 'nullable|array',
            'status'            => 'nullable|string',
        ]);

        $session->update($data);

        return response()->json(['ok' => true, 'saved_at' => now()->toISOString()]);
    }

    public function destroy(GameSession $session)
    {
        $session->delete();
        return response()->json(['ok' => true]);
    }

    public function sessions(Project $project)
    {
        return response()->json($project->gameSessions()->orderByDesc('updated_at')->get());
    }
}
