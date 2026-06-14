<template>
  <div
    class="game-root"
    @contextmenu.prevent
  >
    <!-- Canvas fills everything except sidebar and bottom bar -->
    <canvas
      ref="canvas"
      class="game-canvas"
      :width="canvasW"
      :height="canvasH"
    ></canvas>

    <!-- Right sidebar: credits, power, build menu, minimap -->
    <aside class="sidebar">
      <!-- Credits -->
      <div class="credits-box">
        <span class="credits-label">$</span>
        <span class="credits-value">{{ formatNum(credits) }}</span>
      </div>

      <!-- Power indicator -->
      <div class="power-box" :class="power.deficit ? 'power-deficit' : 'power-ok'">
        <span class="power-icon">⚡</span>
        <span class="power-text">{{ power.supply }} / {{ power.drain }}</span>
        <span v-if="power.deficit" class="power-warn">LOW</span>
      </div>

      <!-- Speed controls -->
      <div class="speed-row">
        <button
          v-for="s in speeds" :key="s.v"
          @click="setSpeed(s.v)"
          :class="['speed-btn', currentSpeed === s.v ? 'speed-active' : '']"
        >{{ s.l }}</button>
      </div>

      <!-- Build menu -->
      <div class="section-label">BUILD</div>
      <div class="build-list">
        <button
          v-for="b in availableBuildings" :key="b.key"
          @click="toggleBuild(b.key)"
          :class="['build-btn', buildingKey === b.key ? 'build-selected' : '', !b.canAfford ? 'build-disabled' : '']"
          :title="buildTooltip(b)"
        >
          <span class="build-name">{{ b.name }}</span>
          <span class="build-cost">{{ (b.cost || {}).gold ?? 0 }}$</span>
        </button>
      </div>

      <!-- Production queue for selected building -->
      <template v-if="sel && sel.isBuilding && sel.trainableUnits?.length">
        <div class="section-label">TRAIN</div>
        <div class="train-list">
          <button
            v-for="u in sel.trainableUnits" :key="u.key"
            @click="trainUnit(u.key)"
            class="train-btn"
            :title="u.name + ' · ' + (u.cost?.gold ?? 0) + '$'"
          >
            <span class="train-name">{{ u.name }}</span>
            <span class="train-cost">{{ (u.cost || {}).gold ?? 0 }}$</span>
          </button>
        </div>
        <!-- Queue progress bar -->
        <div v-if="sel.production?.queue?.length" class="queue-box">
          <div class="queue-label">{{ sel.production.queue[0]?.unitKey }}</div>
          <div class="queue-bar-bg">
            <div class="queue-bar-fill" :style="{ width: Math.round(sel.prodProgress * 100) + '%' }"></div>
          </div>
          <div class="queue-count">{{ sel.production.queue.length }} queued</div>
          <button @click="dequeueUnit" class="queue-cancel">✕</button>
        </div>
      </template>

      <!-- Minimap -->
      <div class="minimap-wrap">
        <canvas ref="minimap" :width="mmW" :height="mmH" class="minimap-canvas"></canvas>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <span>FPS {{ stats.fps }}</span>
        <span>ENT {{ stats.entities }}</span>
      </div>
    </aside>

    <!-- Bottom bar: selected entity info + action buttons -->
    <div class="bottom-bar">
      <div class="bottom-left">
        <template v-if="sel">
          <!-- Portrait / identity -->
          <div class="portrait-box">
            <span class="portrait-icon">{{ sel.isBuilding ? '🏛' : '🪖' }}</span>
          </div>
          <div class="entity-info">
            <div class="entity-name">{{ sel.label }}</div>
            <div v-if="sel.health" class="hp-row">
              <div class="hp-bar-bg">
                <div
                  class="hp-bar-fill"
                  :class="hpColor(sel.health)"
                  :style="{ width: hpPct(sel.health) + '%' }"
                ></div>
              </div>
              <span class="hp-text">{{ sel.health.hp }} / {{ sel.health.maxHp }}</span>
            </div>
            <div v-if="sel.unit" class="entity-type">{{ sel.unit.category }}</div>
            <div v-if="sel.harvester" class="harv-row">
              ⛏ {{ Math.floor(sel.harvester.carryAmount) }} / {{ sel.harvester.maxCarry }}
              <span class="harv-state">{{ sel.harvester.state }}</span>
            </div>
            <div v-if="sel.count > 1" class="sel-count">+{{ sel.count - 1 }} more</div>
          </div>
        </template>
        <div v-else class="no-sel">No selection</div>
      </div>

      <!-- Center action buttons -->
      <div class="action-btns">
        <button v-if="sel?.isUnit" @click="cmdStop"      class="action-btn">Stop</button>
        <button v-if="sel?.isUnit" @click="cmdHold"      class="action-btn">Hold</button>
        <button v-if="sel?.isUnit" @click="cmdAttackMove" class="action-btn">A-Move</button>
        <button v-if="sel?.isBuilding && !sel?.isUnit" @click="sellSelected" class="action-btn action-sell">Sell</button>
      </div>

      <!-- Back button -->
      <div class="bottom-right">
        <button @click="goHome" class="home-btn">← Menu</button>
      </div>
    </div>

    <!-- Notifications (top-center) -->
    <div class="notif-area">
      <div v-for="n in notifications" :key="n.id" class="notif">{{ n.text }}</div>
    </div>

    <!-- Defeat / Victory overlay -->
    <div v-if="gameOver" class="gameover-overlay">
      <div class="gameover-box">
        <div class="gameover-title" :class="gameOver === 'victory' ? 'gameover-win' : 'gameover-lose'">
          {{ gameOver === 'victory' ? '🏆 VICTORY' : '💀 DEFEAT' }}
        </div>
        <button @click="goHome" class="gameover-btn">Return to Menu</button>
      </div>
    </div>

    <!-- Generating overlay -->
    <div v-if="generating" class="gen-overlay">
      <div class="gen-text">Generating world…</div>
      <div class="gen-bar"><div class="gen-fill"></div></div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { router } from '@inertiajs/vue3';
import { GameEngine } from '../../game/engine/GameEngine.js';

const props = defineProps({ session: Object });

// -------------------------------------------------------
// Refs & reactive state
// -------------------------------------------------------
const canvas     = ref(null);
const minimap    = ref(null);
const generating = ref(true);
const gameOver   = ref(null);

const mmW = 172;
const mmH = 110;

const canvasW = ref(window.innerWidth - 180); // sidebar is 180px
const canvasH = ref(window.innerHeight - 64); // bottom bar is 64px

const credits      = ref(0);
const power        = reactive({ supply: 0, drain: 0, deficit: false });
const stats        = reactive({ fps: 0, tps: 0, entities: 0, speed: 1 });
const sel          = ref(null);
const availableBuildings = ref([]);
const buildingKey  = ref(null);
const currentSpeed = ref(1);
const notifications = ref([]);
let   notifId      = 0;

const speeds = [
  { v: 0, l: '⏸' },
  { v: 1, l: '1×' },
  { v: 2, l: '2×' },
  { v: 4, l: '4×' },
];

// -------------------------------------------------------
// Engine ref
// -------------------------------------------------------
let engine = null;
let rafId  = null;

onMounted(async () => {
  await nextTick();
  window.addEventListener('resize', onResize);
  setTimeout(initEngine, 80);
});

onUnmounted(() => {
  engine?.stop();
  window.removeEventListener('resize', onResize);
  cancelAnimationFrame(rafId);
});

function onResize() {
  canvasW.value = window.innerWidth - 180;
  canvasH.value = window.innerHeight - 64;
  engine?.resize(canvasW.value, canvasH.value);
}

function initEngine() {
  const cfg = buildConfig();
  engine    = new GameEngine(canvas.value, cfg);

  engine.on('defeat',  () => { gameOver.value = 'defeat'; });
  engine.on('victory', () => { gameOver.value = 'victory'; });
  engine.on('buildingPlaced', k => notify(`${k} placed`));
  engine.on('entityDestroyed', () => { /* selection auto-cleaned in engine */ });

  if (props.session.ecs_state) {
    engine.loadGame({
      tick:             props.session.tick || 0,
      mapData:          JSON.parse(props.session.map_data || 'null'),
      ecsState:         JSON.parse(props.session.ecs_state),
      factionResources: props.session.faction_resources || {},
      playerFactionId:  props.session.player_faction_id || null,
    });
  } else {
    engine.newGame(props.session.seed, {
      map_width:  props.session.map_width  || 96,
      map_height: props.session.map_height || 96,
      starting_resources: cfg.settings?.starting_resources || {},
    });
  }

  generating.value = false;
  engine.start();
  uiLoop();
}

function buildConfig() {
  const proj = props.session.project || {};
  return {
    factions:        proj.factions         || [],
    unitConfigs:     proj.unit_configs     || [],
    buildingConfigs: proj.building_configs || [],
    techConfigs:     proj.tech_configs     || [],
    eventConfigs:    proj.event_configs    || [],
    resourceConfigs: proj.resource_configs || [],
    settings:        proj.settings         || {},
  };
}

function uiLoop() {
  rafId = requestAnimationFrame(uiLoop);
  if (!engine) return;

  const s = engine.getStats();
  stats.fps      = s.fps;
  stats.entities = s.entities;
  stats.speed    = s.speed;
  currentSpeed.value = s.speed;
  credits.value  = s.credits ?? 0;
  Object.assign(power, s.power || { supply: 0, drain: 0, deficit: false });

  sel.value              = engine.getSelectedInfo();
  availableBuildings.value = engine.getAvailableBuildings();

  // Minimap
  const mmCtx = minimap.value?.getContext('2d');
  if (mmCtx && engine.render) {
    mmCtx.clearRect(0, 0, mmW, mmH);
    engine.render.renderMinimap(mmCtx, mmW, mmH);
  }
}

// -------------------------------------------------------
// HUD actions
// -------------------------------------------------------
function setSpeed(v)       { currentSpeed.value = v; engine?.setSpeed(v); }
function toggleBuild(key)  {
  const next = buildingKey.value === key ? null : key;
  buildingKey.value = next;
  engine?.setBuildMode(next);
}
function trainUnit(key)   { if (sel.value?.id != null) engine?.enqueueUnit(sel.value.id, key); }
function dequeueUnit()    { if (sel.value?.id != null) engine?.dequeueUnit(sel.value.id); }
function sellSelected()   { engine?._sellSelected?.(); }
function cmdStop()        {
  if (!sel.value) return;
  for (const id of engine?.selectedEntities ?? []) {
    const mov = engine?.ecs?.getComponent(id, 'movement');
    if (mov) { mov.path = []; mov.state = 'idle'; }
  }
}
function cmdHold()         { /* Hold ground — stop and don't pursue */ cmdStop(); }
function cmdAttackMove()   { notify('Click ground to attack-move'); /* handled by engine right-click */ }
function goHome()          { engine?.stop(); router.visit('/'); }

function notify(text) {
  const id = ++notifId;
  notifications.value.unshift({ id, text });
  setTimeout(() => {
    const i = notifications.value.findIndex(n => n.id === id);
    if (i !== -1) notifications.value.splice(i, 1);
  }, 3000);
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
function formatNum(n) {
  return n >= 10000 ? Math.floor(n / 1000) + 'k'
       : n >= 1000  ? (n / 1000).toFixed(1) + 'k'
       : Math.floor(n);
}

function hpPct(hp) { return hp ? Math.round((hp.hp / hp.maxHp) * 100) : 0; }
function hpColor(hp) {
  const p = hpPct(hp);
  return p > 60 ? 'hp-green' : p > 30 ? 'hp-yellow' : 'hp-red';
}

function buildTooltip(b) {
  const cost = (b.cost || {}).gold ?? 0;
  return `${b.name}\n${cost}$ · ${b.build_time || '?'}s`;
}
</script>

<style>
/* --- Layout --- */
.game-root {
  position: fixed;
  inset: 0;
  background: #080808;
  display: flex;
  user-select: none;
  overflow: hidden;
}

.game-canvas {
  position: absolute;
  top: 0;
  left: 0;
  right: 180px;
  bottom: 64px;
  cursor: crosshair;
}

/* --- Right sidebar --- */
.sidebar {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 64px;
  width: 180px;
  background: #0e0e0e;
  border-left: 1px solid #222;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.credits-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px 4px;
  background: #141414;
  border-bottom: 1px solid #222;
}
.credits-label { color: #ffd700; font-size: 1.1rem; font-weight: bold; }
.credits-value { color: #ffd700; font-size: 1rem; font-weight: bold; font-variant-numeric: tabular-nums; }

.power-box {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  font-size: 0.7rem;
  border-bottom: 1px solid #222;
}
.power-ok      { background: #0a1a0a; color: #44dd44; }
.power-deficit { background: #1a0a0a; color: #ff4444; animation: power-blink 1s infinite; }
@keyframes power-blink { 0%,100%{opacity:1} 50%{opacity:0.5} }
.power-icon { font-size: 0.85rem; }
.power-warn { margin-left: auto; font-weight: bold; font-size: 0.65rem; letter-spacing: 0.05em; }

.speed-row {
  display: flex;
  gap: 3px;
  padding: 4px 8px;
  border-bottom: 1px solid #222;
}
.speed-btn {
  flex: 1;
  background: #1c1c1c;
  border: 1px solid #333;
  color: #aaa;
  font-size: 0.7rem;
  padding: 2px 0;
  cursor: pointer;
  border-radius: 3px;
}
.speed-btn:hover { background: #2a2a2a; color: #fff; }
.speed-active    { background: #7a5a00; border-color: #c8980a; color: #ffd700; }

.section-label {
  font-size: 0.6rem;
  color: #555;
  letter-spacing: 0.1em;
  padding: 4px 10px 2px;
  text-transform: uppercase;
}

.build-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 6px;
  overflow-y: auto;
  flex-shrink: 0;
  max-height: 160px;
}
.build-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #ccc;
  font-size: 0.7rem;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 3px;
  text-align: left;
}
.build-btn:hover      { background: #252525; border-color: #555; color: #fff; }
.build-selected       { background: #1a3040; border-color: #2a8aff; color: #7ec8ff; }
.build-disabled       { opacity: 0.45; cursor: not-allowed; }
.build-name           { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.build-cost           { color: #ffd700; margin-left: 6px; flex-shrink: 0; }

.train-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 6px;
  max-height: 120px;
  overflow-y: auto;
}
.train-btn {
  display: flex;
  justify-content: space-between;
  background: #141e14;
  border: 1px solid #2a4a2a;
  color: #acd8ac;
  font-size: 0.7rem;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 3px;
}
.train-btn:hover { background: #1e2e1e; color: #fff; }
.train-name      { flex: 1; }
.train-cost      { color: #ffd700; margin-left: 6px; }

.queue-box {
  margin: 4px 6px;
  background: #141414;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 5px 8px;
  font-size: 0.65rem;
  color: #aaa;
  position: relative;
}
.queue-label     { color: #ccc; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.queue-bar-bg    { height: 4px; background: #333; border-radius: 2px; overflow: hidden; }
.queue-bar-fill  { height: 100%; background: #2a8aff; border-radius: 2px; transition: width 0.3s; }
.queue-count     { margin-top: 2px; color: #666; }
.queue-cancel    {
  position: absolute; top: 4px; right: 6px;
  background: none; border: none; color: #666; cursor: pointer; font-size: 0.75rem;
}
.queue-cancel:hover { color: #ff4444; }

.minimap-wrap {
  margin-top: auto;
  padding: 6px;
  border-top: 1px solid #222;
}
.minimap-canvas {
  display: block;
  width: 100%;
  border: 1px solid #333;
  border-radius: 3px;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 10px 6px;
  font-size: 0.6rem;
  color: #444;
}

/* --- Bottom bar --- */
.bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: #0d0d0d;
  border-top: 2px solid #1c1c1c;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
}

.bottom-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 280px;
}

.portrait-box {
  width: 44px;
  height: 44px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.entity-info { flex: 1; min-width: 0; }
.entity-name { color: #eee; font-size: 0.75rem; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hp-row      { display: flex; align-items: center; gap: 6px; margin: 3px 0; }
.hp-bar-bg   { flex: 1; height: 5px; background: #333; border-radius: 3px; overflow: hidden; }
.hp-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.hp-green    { background: #44dd44; }
.hp-yellow   { background: #ddaa00; }
.hp-red      { background: #dd2222; }
.hp-text     { color: #aaa; font-size: 0.65rem; white-space: nowrap; }
.entity-type { color: #888; font-size: 0.65rem; text-transform: capitalize; }
.harv-row    { color: #ffd700; font-size: 0.65rem; }
.harv-state  { color: #888; margin-left: 6px; }
.sel-count   { color: #666; font-size: 0.65rem; }
.no-sel      { color: #444; font-size: 0.75rem; padding: 0 8px; }

.action-btns {
  display: flex;
  gap: 6px;
}
.action-btn {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #aaa;
  font-size: 0.7rem;
  padding: 5px 12px;
  cursor: pointer;
  border-radius: 4px;
  white-space: nowrap;
}
.action-btn:hover  { background: #2a2a2a; color: #fff; border-color: #555; }
.action-sell       { border-color: #4a1010; color: #ee6666; }
.action-sell:hover { background: #2a1010; color: #ff8888; border-color: #882222; }

.bottom-right  { margin-left: auto; }
.home-btn {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #666;
  font-size: 0.7rem;
  padding: 6px 14px;
  cursor: pointer;
  border-radius: 4px;
}
.home-btn:hover { color: #fff; border-color: #555; }

/* --- Notifications --- */
.notif-area {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
  z-index: 10;
}
.notif {
  background: rgba(10,10,10,0.9);
  border: 1px solid #333;
  color: #ddd;
  font-size: 0.75rem;
  padding: 5px 16px;
  border-radius: 4px;
  white-space: nowrap;
}

/* --- Game Over Overlay --- */
.gameover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}
.gameover-box {
  background: #0e0e0e;
  border: 2px solid #333;
  border-radius: 8px;
  padding: 40px 60px;
  text-align: center;
}
.gameover-title { font-size: 2rem; font-weight: bold; margin-bottom: 24px; }
.gameover-win   { color: #ffd700; }
.gameover-lose  { color: #ff3333; }
.gameover-btn {
  background: #1a1a1a;
  border: 1px solid #555;
  color: #fff;
  font-size: 0.85rem;
  padding: 10px 28px;
  cursor: pointer;
  border-radius: 5px;
}
.gameover-btn:hover { background: #2a2a2a; }

/* --- Generating overlay --- */
.gen-overlay {
  position: absolute;
  inset: 0;
  background: #060606;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 30;
}
.gen-text { color: #ffd700; font-size: 1.25rem; font-weight: bold; margin-bottom: 16px; }
.gen-bar  { width: 180px; height: 6px; background: #222; border-radius: 3px; overflow: hidden; }
.gen-fill { height: 100%; width: 66%; background: #ffd700; border-radius: 3px; animation: gen-pulse 1.2s infinite; }
@keyframes gen-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
</style>
