<?php

use App\Http\Controllers\ProjectController;
use App\Http\Controllers\GameController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Home / project list
Route::get('/', [ProjectController::class, 'index'])->name('home');
Route::post('/projects', [ProjectController::class, 'store'])->name('projects.store');
Route::patch('/projects/{project}', [ProjectController::class, 'update'])->name('projects.update');
Route::delete('/projects/{project}', [ProjectController::class, 'destroy'])->name('projects.destroy');

// Editor
Route::get('/editor/{project}', [ProjectController::class, 'editor'])->name('editor.index');
Route::post('/projects/{project}/factions', [ProjectController::class, 'storeFaction'])->name('factions.store');
Route::patch('/projects/{project}/factions/{faction}', [ProjectController::class, 'updateFaction'])->name('factions.update');
Route::delete('/projects/{project}/factions/{faction}', [ProjectController::class, 'destroyFaction'])->name('factions.destroy');
Route::post('/projects/{project}/units', [ProjectController::class, 'storeUnit'])->name('units.store');
Route::patch('/projects/{project}/units/{unit}', [ProjectController::class, 'updateUnit'])->name('units.update');
Route::delete('/projects/{project}/units/{unit}', [ProjectController::class, 'destroyUnit'])->name('units.destroy');
Route::post('/projects/{project}/buildings', [ProjectController::class, 'storeBuilding'])->name('buildings.store');
Route::patch('/projects/{project}/buildings/{building}', [ProjectController::class, 'updateBuilding'])->name('buildings.update');
Route::delete('/projects/{project}/buildings/{building}', [ProjectController::class, 'destroyBuilding'])->name('buildings.destroy');
Route::post('/projects/{project}/techs', [ProjectController::class, 'storeTech'])->name('techs.store');
Route::patch('/projects/{project}/techs/{tech}', [ProjectController::class, 'updateTech'])->name('techs.update');
Route::delete('/projects/{project}/techs/{tech}', [ProjectController::class, 'destroyTech'])->name('techs.destroy');
Route::post('/projects/{project}/events', [ProjectController::class, 'storeEvent'])->name('events.store');
Route::patch('/projects/{project}/events/{event}', [ProjectController::class, 'updateEvent'])->name('events.update');
Route::delete('/projects/{project}/events/{event}', [ProjectController::class, 'destroyEvent'])->name('events.destroy');

// Game runtime
Route::post('/projects/{project}/sessions', [GameController::class, 'create'])->name('game.create');
Route::get('/play/{session}', [GameController::class, 'play'])->name('game.play');
Route::patch('/sessions/{session}/save', [GameController::class, 'save'])->name('game.save');
Route::delete('/sessions/{session}', [GameController::class, 'destroy'])->name('game.destroy');
Route::get('/projects/{project}/sessions', [GameController::class, 'sessions'])->name('game.sessions');
