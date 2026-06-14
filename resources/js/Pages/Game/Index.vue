<template>
  <div
    class="game-root"
    @contextmenu.prevent
  >
    <canvas
      ref="canvas"
      class="game-canvas"
      :width="canvasW"
      :height="canvasH"
    ></canvas>

    <header class="battle-rail">
      <div class="rail-brand">
        <span class="brand-mark">RTS</span>
        <span class="brand-sub">TACTICAL UPLINK</span>
      </div>
      <div class="rail-metrics">
        <div class="metric metric-credit">
          <span class="metric-label">Credits</span>
          <span class="metric-value">{{ formatNum(credits) }}</span>
        </div>
        <div class="metric" :class="power.deficit ? 'metric-danger' : 'metric-power'">
          <span class="metric-label">Power</span>
          <span class="metric-value">{{ power.supply }} / {{ power.drain }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Entities</span>
          <span class="metric-value">{{ stats.entities }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">FPS</span>
          <span class="metric-value">{{ stats.fps }}</span>
        </div>
      </div>
      <button @click="goHome" class="home-btn">MENU</button>
    </header>

    <aside class="command-deck">
      <section class="deck-panel radar-panel">
        <div class="panel-title">
          <span>Radar</span>
          <span class="panel-code">ONLINE</span>
        </div>
        <div class="minimap-frame">
          <canvas ref="minimap" :width="mmW" :height="mmH" class="minimap-canvas"></canvas>
          <div class="scanline"></div>
        </div>
      </section>

      <section class="deck-panel selection-panel">
        <div class="panel-title">
          <span>Selection</span>
          <span v-if="sel?.count > 1" class="panel-code">{{ sel.count }} UNITS</span>
        </div>
        <template v-if="sel">
          <div class="selection-card">
            <div class="portrait-box">
              <span class="portrait-glyph">{{ sel.isBuilding ? '▰' : '▲' }}</span>
            </div>
            <div class="entity-info">
              <div class="entity-name">{{ displayName(sel.label) }}</div>
              <div class="entity-type">{{ sel.unit?.category || sel.building?.category || 'asset' }}</div>
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
              <div v-if="sel.harvester" class="cargo-row">
                <span>Cargo</span>
                <strong>{{ Math.floor(sel.harvester.carryAmount) }} / {{ sel.harvester.maxCarry }}</strong>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="no-sel">
          <span class="no-sel-main">No active selection</span>
          <span class="no-sel-sub">Drag-select units or click a structure.</span>
        </div>
      </section>

      <section class="deck-panel command-panel">
        <div class="panel-title">
          <span>Command</span>
          <span class="panel-code">GRID</span>
        </div>
        <div class="command-grid">
          <button v-if="sel?.isUnit" @click="cmdStop" class="command-btn">
            <span class="cmd-icon">■</span>
            <span>Stop</span>
          </button>
          <button v-if="sel?.isUnit" @click="cmdHold" class="command-btn">
            <span class="cmd-icon">◆</span>
            <span>Hold</span>
          </button>
          <button v-if="sel?.isUnit" @click="cmdAttackMove" class="command-btn">
            <span class="cmd-icon">⌖</span>
            <span>Attack</span>
          </button>
          <button v-if="sel?.isBuilding" @click="sellSelected" class="command-btn command-danger">
            <span class="cmd-icon">⌫</span>
            <span>Sell</span>
          </button>
          <button v-if="!sel" class="command-btn command-empty" disabled>
            <span class="cmd-icon">·</span>
            <span>Await</span>
          </button>
        </div>
      </section>

      <section class="deck-panel build-panel">
        <div class="panel-title">
          <span>Construction</span>
          <span class="panel-code">{{ availableBuildings.length }}</span>
        </div>
        <div class="build-grid">
          <button
            v-for="b in availableBuildings" :key="b.key"
            @click="toggleBuild(b.key)"
            :class="['build-btn', buildingKey === b.key ? 'build-selected' : '', !b.canAfford ? 'build-disabled' : '']"
            :title="buildTooltip(b)"
          >
            <span class="build-icon">{{ buildingGlyph(b) }}</span>
            <span class="build-name">{{ displayName(b.name || b.key) }}</span>
            <span class="build-cost">{{ (b.cost || {}).gold ?? 0 }}</span>
          </button>
        </div>
      </section>

      <section class="deck-panel train-panel">
        <div class="panel-title">
          <span>Production</span>
          <span class="panel-code">{{ sel?.production?.queue?.length || 0 }} Q</span>
        </div>
        <div v-if="sel && sel.isBuilding && sel.trainableUnits?.length" class="train-grid">
          <button
            v-for="u in sel.trainableUnits" :key="u.key"
            @click="trainUnit(u.key)"
            class="train-btn"
            :title="u.name + ' · ' + (u.cost?.gold ?? 0)"
          >
            <span class="train-icon">▲</span>
            <span class="train-name">{{ displayName(u.name || u.key) }}</span>
            <span class="train-cost">{{ (u.cost || {}).gold ?? 0 }}</span>
          </button>
        </div>
        <div v-else class="empty-panel">Select a production structure.</div>
        <div v-if="sel?.production?.queue?.length" class="queue-box">
          <div class="queue-top">
            <span>{{ displayName(sel.production.queue[0]?.unitKey) }}</span>
            <button @click="dequeueUnit" class="queue-cancel">CANCEL</button>
          </div>
          <div class="queue-bar-bg">
            <div class="queue-bar-fill" :style="{ width: Math.round(sel.prodProgress * 100) + '%' }"></div>
          </div>
          <div class="queue-count">{{ sel.production.queue.length }} item{{ sel.production.queue.length === 1 ? '' : 's' }} queued</div>
        </div>
      </section>
    </aside>

    <!-- Notifications (top-center) -->
    <div class="notif-area">
      <div v-for="n in notifications" :key="n.id" class="notif">{{ n.text }}</div>
    </div>

    <!-- Defeat / Victory overlay -->
    <div v-if="gameOver" class="gameover-overlay">
      <div class="gameover-box">
        <div class="gameover-title" :class="gameOver === 'victory' ? 'gameover-win' : 'gameover-lose'">
          {{ gameOver === 'victory' ? 'VICTORY' : 'DEFEAT' }}
        </div>
        <button @click="goHome" class="gameover-btn">Return to Menu</button>
      </div>
    </div>

    <!-- Generating overlay -->
    <div v-if="generating" class="gen-overlay">
      <div class="gen-text">Establishing battlefield uplink...</div>
      <div class="gen-bar"><div class="gen-fill"></div></div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
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

const DECK_W = 340;
const RAIL_H = 56;
const mmW = 292;
const mmH = 156;

const initialCanvas = getCanvasSize();
const canvasW = ref(initialCanvas.w);
const canvasH = ref(initialCanvas.h);

const credits      = ref(0);
const power        = reactive({ supply: 0, drain: 0, deficit: false });
const stats        = reactive({ fps: 0, tps: 0, entities: 0 });
const sel          = ref(null);
const availableBuildings = ref([]);
const buildingKey  = ref(null);
const notifications = ref([]);
let   notifId      = 0;

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
  const size = getCanvasSize();
  canvasW.value = size.w;
  canvasH.value = size.h;
  engine?.resize(canvasW.value, canvasH.value);
}

function getCanvasSize() {
  if (window.innerWidth <= 900) {
    return {
      w: Math.max(320, window.innerWidth),
      h: Math.max(240, Math.floor(window.innerHeight * 0.56) - RAIL_H),
    };
  }

  return {
    w: Math.max(320, window.innerWidth - DECK_W),
    h: Math.max(240, window.innerHeight - RAIL_H),
  };
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
    const mov = engine?.ecs?.getComponent(id, 'Movement');
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
  return `${displayName(b.name || b.key)}\n${cost} credits · ${b.build_time || '?'}s`;
}

function displayName(value) {
  return String(value || '?')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function buildingGlyph(b) {
  const k = String(b.key || b.name || '').toLowerCase();
  if (k.includes('power')) return '⚡';
  if (k.includes('refinery')) return '◆';
  if (k.includes('barracks')) return '▥';
  if (k.includes('factory')) return '▣';
  if (k.includes('radar')) return '⌁';
  if (k.includes('turret') || k.includes('tower')) return '⌖';
  if (k.includes('silo')) return '▤';
  return '▰';
}
</script>

<style>
.game-root {
  position: fixed;
  inset: 0;
  color: #d7e1d6;
  background:
    linear-gradient(90deg, transparent calc(100% - 340px), rgba(4, 6, 5, 0.98) calc(100% - 340px)),
    radial-gradient(circle at 24% 18%, rgba(94, 117, 82, 0.22), transparent 34%),
    #050706;
  font-family: "Arial Narrow", "Inter", ui-sans-serif, system-ui, sans-serif;
  overflow: hidden;
  user-select: none;
}

.game-canvas {
  position: absolute;
  left: 0;
  top: 56px;
  width: calc(100vw - 340px);
  height: calc(100vh - 56px);
  cursor: crosshair;
  background: #11180f;
}

.battle-rail {
  position: absolute;
  top: 0;
  left: 0;
  right: 340px;
  height: 56px;
  display: grid;
  grid-template-columns: 178px minmax(280px, 1fr) 72px;
  align-items: stretch;
  gap: 8px;
  padding: 7px 10px;
  background:
    linear-gradient(180deg, rgba(52, 61, 50, 0.98), rgba(15, 20, 16, 0.98)),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 7px);
  border-bottom: 2px solid #040604;
  box-shadow: inset 0 -1px 0 rgba(212, 232, 183, 0.18), 0 4px 16px rgba(0,0,0,0.42);
  z-index: 5;
}

.rail-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 50px;
  height: 34px;
  color: #161a13;
  background: linear-gradient(180deg, #d6c46a, #8f7b2f);
  border: 1px solid #f4e896;
  font-weight: 900;
  font-size: 0.92rem;
  box-shadow: inset 0 0 0 2px rgba(0,0,0,0.28);
}

.brand-sub {
  color: #b9c5ae;
  font-size: 0.67rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  white-space: nowrap;
}

.rail-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(88px, 1fr));
  gap: 6px;
  min-width: 0;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
  padding: 0 10px;
  background: linear-gradient(180deg, rgba(11, 15, 12, 0.94), rgba(24, 30, 24, 0.94));
  border: 1px solid #384135;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
}

.metric-label {
  color: #798875;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-value {
  color: #e2ead4;
  font-size: 0.86rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.metric-credit .metric-value { color: #e6c65a; }
.metric-power .metric-value { color: #79d38b; }
.metric-danger {
  border-color: #933f35;
  background: linear-gradient(180deg, rgba(44, 13, 11, 0.96), rgba(21, 8, 7, 0.96));
  animation: power-blink 1s infinite;
}
.metric-danger .metric-value { color: #ff7868; }

@keyframes power-blink { 0%,100%{opacity:1} 50%{opacity:0.68} }

.home-btn,
.command-btn,
.build-btn,
.train-btn,
.queue-cancel,
.gameover-btn {
  border-radius: 0;
  cursor: pointer;
  font-weight: 900;
  letter-spacing: 0.03em;
}

.home-btn:hover,
.command-btn:hover,
.build-btn:hover,
.train-btn:hover {
  color: #fff4b8;
  border-color: #d7b75a;
}

.home-btn {
  color: #c9bfb1;
  background: linear-gradient(180deg, #302823, #15120f);
  border: 1px solid #5b4d3d;
  font-size: 0.68rem;
}

.command-deck {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background:
    linear-gradient(180deg, rgba(33, 39, 32, 0.98), rgba(9, 12, 10, 0.99)),
    repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 9px);
  border-left: 2px solid #080b08;
  box-shadow: inset 1px 0 0 rgba(225,235,194,0.12), -10px 0 22px rgba(0,0,0,0.38);
  z-index: 6;
}

.deck-panel {
  position: relative;
  background: linear-gradient(180deg, rgba(21, 27, 22, 0.98), rgba(10, 13, 11, 0.98));
  border: 1px solid #3b4639;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 0 rgba(0,0,0,0.45);
}

.deck-panel::before {
  content: "";
  position: absolute;
  inset: 3px;
  border: 1px solid rgba(164, 181, 145, 0.08);
  pointer-events: none;
}

.panel-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  color: #e0dcc6;
  background: linear-gradient(180deg, rgba(66, 75, 60, 0.76), rgba(25, 31, 25, 0.78));
  border-bottom: 1px solid #323c31;
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.panel-code {
  color: #8fb184;
  font-size: 0.56rem;
  font-variant-numeric: tabular-nums;
}

.radar-panel { padding-bottom: 10px; }

.minimap-frame {
  position: relative;
  margin: 10px;
  padding: 8px;
  background: #030503;
  border: 1px solid #526050;
  box-shadow: inset 0 0 16px rgba(89, 180, 94, 0.18);
}

.minimap-canvas {
  display: block;
  width: 100%;
  height: 156px;
  image-rendering: pixelated;
  background: #050806;
}

.scanline {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 16px;
  height: 1px;
  background: rgba(150, 255, 147, 0.48);
  box-shadow: 0 0 10px rgba(111, 255, 111, 0.56);
  animation: scanline 3.6s linear infinite;
}

@keyframes scanline {
  from { transform: translateY(0); }
  to { transform: translateY(140px); }
}

.selection-panel { min-height: 122px; }

.selection-card {
  display: grid;
  grid-template-columns: 74px 1fr;
  gap: 10px;
  padding: 12px;
}

.portrait-box {
  display: grid;
  place-items: center;
  width: 74px;
  height: 74px;
  background:
    radial-gradient(circle at 50% 42%, rgba(214, 196, 106, 0.16), transparent 40%),
    linear-gradient(180deg, #151b16, #090b09);
  border: 1px solid #596854;
  box-shadow: inset 0 0 18px rgba(0,0,0,0.8);
}

.portrait-glyph {
  color: #e0c96b;
  font-size: 2rem;
  text-shadow: 0 0 12px rgba(224, 201, 107, 0.55);
}

.entity-info { min-width: 0; }

.entity-name {
  color: #f1eddb;
  font-size: 0.96rem;
  font-weight: 900;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entity-type {
  margin-top: 4px;
  color: #95a38f;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hp-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.hp-bar-bg,
.queue-bar-bg {
  height: 8px;
  background: #080a08;
  border: 1px solid #2d352c;
  overflow: hidden;
}

.hp-bar-fill,
.queue-bar-fill {
  height: 100%;
  transition: width 0.2s linear;
}

.hp-green { background: linear-gradient(90deg, #438f4e, #9be067); }
.hp-yellow { background: linear-gradient(90deg, #9b7d25, #ead66e); }
.hp-red { background: linear-gradient(90deg, #8c302a, #f05c48); }
.hp-text {
  color: #c8d2bf;
  font-size: 0.62rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.cargo-row {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  color: #cdb864;
  font-size: 0.66rem;
  font-weight: 800;
}

.no-sel {
  display: grid;
  gap: 6px;
  padding: 16px 12px;
}

.no-sel-main {
  color: #d0d8c8;
  font-size: 0.86rem;
  font-weight: 900;
}

.no-sel-sub {
  color: #74816d;
  font-size: 0.66rem;
}

.command-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 10px;
}

.command-btn {
  display: grid;
  grid-template-columns: 28px 1fr;
  align-items: center;
  min-height: 42px;
  color: #cfd9c8;
  background: linear-gradient(180deg, #222b22, #0d110e);
  border: 1px solid #485546;
  text-align: left;
  font-size: 0.7rem;
}

.cmd-icon {
  display: grid;
  place-items: center;
  height: 100%;
  color: #e0c96b;
  background: rgba(0,0,0,0.25);
  border-right: 1px solid #3d493a;
}

.command-danger {
  color: #f2b0a6;
  border-color: #774238;
}

.command-empty {
  opacity: 0.55;
  cursor: default;
}

.build-panel,
.train-panel {
  min-height: 0;
  flex: 1;
}

.build-grid,
.train-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  max-height: calc((100vh - 530px) / 2);
  min-height: 116px;
  padding: 10px;
  overflow-y: auto;
}

.build-btn,
.train-btn {
  display: grid;
  grid-template-columns: 28px 1fr;
  grid-template-rows: 1fr auto;
  column-gap: 7px;
  min-height: 58px;
  padding: 6px;
  color: #d6dfcf;
  background: linear-gradient(180deg, #222a22, #0f130f);
  border: 1px solid #43503f;
  text-align: left;
}

.build-icon,
.train-icon {
  grid-row: 1 / span 2;
  display: grid;
  place-items: center;
  color: #e0c96b;
  background: rgba(0,0,0,0.28);
  border: 1px solid rgba(224, 201, 107, 0.22);
  font-size: 1rem;
}

.build-name,
.train-name {
  align-self: end;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #ecf1df;
  font-size: 0.64rem;
  font-weight: 900;
  line-height: 1.1;
  white-space: nowrap;
}

.build-cost,
.train-cost {
  color: #d8c260;
  font-size: 0.62rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.build-selected {
  border-color: #e0c96b;
  background: linear-gradient(180deg, #4c4524, #18150c);
  box-shadow: inset 0 0 0 1px rgba(240, 216, 117, 0.25);
}

.build-disabled {
  opacity: 0.42;
  filter: grayscale(0.45);
}

.empty-panel {
  margin: 10px;
  padding: 18px 10px;
  color: #73816d;
  background: rgba(0,0,0,0.18);
  border: 1px dashed #3f4a3d;
  font-size: 0.66rem;
  font-weight: 800;
  text-align: center;
  text-transform: uppercase;
}

.queue-box {
  margin: 0 10px 10px;
  padding: 9px;
  background: linear-gradient(180deg, #111711, #080a08);
  border: 1px solid #3f4a3d;
}

.queue-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #e4e9d7;
  font-size: 0.66rem;
  font-weight: 900;
  margin-bottom: 7px;
}

.queue-cancel {
  color: #ff9a88;
  background: transparent;
  border: 0;
  font-size: 0.56rem;
}

.queue-bar-fill {
  background: linear-gradient(90deg, #92782d, #e3ca68);
}

.queue-count {
  margin-top: 6px;
  color: #83917c;
  font-size: 0.58rem;
  font-weight: 800;
}

.notif-area {
  position: absolute;
  top: 70px;
  left: calc((100vw - 340px) / 2);
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 5px;
  pointer-events: none;
  z-index: 10;
}

.notif {
  color: #f3edc4;
  background: rgba(18, 23, 18, 0.92);
  border: 1px solid #6d6941;
  box-shadow: 0 6px 20px rgba(0,0,0,0.36);
  font-size: 0.7rem;
  font-weight: 900;
  padding: 7px 18px;
  white-space: nowrap;
}

.gameover-overlay,
.gen-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  background: rgba(0,0,0,0.78);
}

.gameover-box {
  min-width: 360px;
  padding: 36px 48px;
  text-align: center;
  background: linear-gradient(180deg, #1f281f, #080a08);
  border: 2px solid #566151;
  box-shadow: inset 0 0 0 1px rgba(230, 198, 90, 0.18), 0 18px 60px rgba(0,0,0,0.6);
}

.gameover-title {
  margin-bottom: 24px;
  font-size: 2.4rem;
  font-weight: 1000;
  letter-spacing: 0.12em;
}

.gameover-win { color: #e6c65a; }
.gameover-lose { color: #ef6b58; }

.gameover-btn {
  padding: 10px 24px;
  color: #ede6c5;
  background: linear-gradient(180deg, #30382e, #111510);
  border: 1px solid #6c765f;
}

.gen-overlay {
  flex-direction: column;
  background:
    radial-gradient(circle at center, rgba(95, 121, 75, 0.22), transparent 34%),
    #050706;
}

.gen-text {
  color: #e6c65a;
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  margin-bottom: 18px;
  text-transform: uppercase;
}

.gen-bar {
  width: 280px;
  height: 8px;
  background: #111611;
  border: 1px solid #485546;
  overflow: hidden;
}

.gen-fill {
  height: 100%;
  width: 66%;
  background: linear-gradient(90deg, #6b5a25, #e6c65a);
  animation: gen-pulse 1.2s infinite;
}

@keyframes gen-pulse { 0%,100%{opacity:1} 50%{opacity:0.44} }

@media (max-width: 900px) {
  .battle-rail {
    right: 0;
    grid-template-columns: 120px 1fr;
  }

  .home-btn {
    display: none;
  }

  .command-deck {
    width: 100vw;
    top: auto;
    height: 44vh;
  }

  .game-canvas {
    width: 100vw;
    height: 56vh;
  }

  .rail-metrics {
    grid-template-columns: repeat(2, minmax(72px, 1fr));
  }
}
</style>
