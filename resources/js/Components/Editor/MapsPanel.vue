<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-white">Map Presets</h2>
        <p class="text-sm text-gray-500 mt-1">Configure procedural map parameters used when starting a game.</p>
      </div>
      <button @click="openForm(null)" class="bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold px-4 py-2 rounded text-sm">+ Add Map</button>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div v-for="m in maps" :key="m.id" class="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-white truncate">{{ m.name }}</span>
              <span v-if="m.is_default" class="text-xs px-2 py-0.5 rounded bg-green-900 text-green-300">Default</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">{{ m.width }} x {{ m.height }} tiles · {{ m.max_players }} players</p>
          </div>
          <div class="flex gap-1 shrink-0">
            <button @click="openForm(m)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">Edit</button>
            <button @click="remove(m)" class="text-xs bg-red-900 hover:bg-red-700 px-2 py-1 rounded">Del</button>
          </div>
        </div>
        <p class="text-sm text-gray-400 mb-3">{{ m.description || 'No description.' }}</p>
        <div v-if="m.music_url" class="mb-3 rounded border border-gray-800 bg-gray-950 p-2">
          <div class="flex items-center justify-between gap-3 text-xs text-gray-400 mb-2">
            <span class="truncate">Music: {{ m.music_name || 'Uploaded track' }}</span>
            <a :href="m.music_url" target="_blank" class="text-amber-300 hover:text-amber-200 shrink-0">Open</a>
          </div>
          <audio :src="m.music_url" controls class="w-full h-8"></audio>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div class="stat"><span>Sea</span><strong>{{ setting(m, 'seaLevel') }}</strong></div>
          <div class="stat"><span>Mountains</span><strong>{{ setting(m, 'mountainH') }}</strong></div>
          <div class="stat"><span>Rivers</span><strong>{{ setting(m, 'riverCount') }}</strong></div>
          <div class="stat"><span>Mines</span><strong>{{ setting(m, 'mineCount') }}</strong></div>
          <div class="stat"><span>Forests</span><strong>{{ setting(m, 'forestThickness') }}</strong></div>
          <div class="stat"><span>Scale</span><strong>{{ setting(m, 'scale') }}</strong></div>
        </div>
      </div>
    </div>
    <div v-if="!maps?.length" class="text-center py-16 text-gray-500">No map presets defined yet.</div>

    <div v-if="showForm" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 py-4 overflow-y-auto">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-4xl shadow-2xl mx-4">
        <h3 class="text-lg font-bold mb-4 text-amber-400">{{ editing ? 'Edit' : 'New' }} Map Preset</h3>
        <form @submit.prevent="save">
          <div class="grid grid-cols-3 gap-3 mb-3">
            <div><label class="label">Key</label><input v-model="form.key" required class="input" placeholder="balanced_frontier" /></div>
            <div><label class="label">Name</label><input v-model="form.name" required class="input" placeholder="Balanced Frontier" /></div>
            <label class="flex items-end gap-2 pb-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" v-model="form.is_default" class="accent-amber-500" />
              Default map
            </label>
          </div>

          <div class="mb-3">
            <label class="label">Description</label>
            <textarea v-model="form.description" rows="2" class="input resize-none"></textarea>
          </div>

          <div class="grid grid-cols-3 gap-3 mb-4">
            <div><label class="label">Width</label><input v-model.number="form.width" type="number" min="64" max="256" class="input" /></div>
            <div><label class="label">Height</label><input v-model.number="form.height" type="number" min="64" max="256" class="input" /></div>
            <div><label class="label">Max Players</label><input v-model.number="form.max_players" type="number" min="2" max="8" class="input" /></div>
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div v-for="field in numericFields" :key="field.key">
              <label class="label">{{ field.label }}</label>
              <input
                v-model.number="form.procedural_settings[field.key]"
                type="number"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                class="input"
              />
            </div>
          </div>

          <details class="mb-4">
            <summary class="text-sm text-gray-400 cursor-pointer mb-2">Raw procedural JSON</summary>
            <textarea v-model="settingsText" rows="7" class="input resize-none font-mono text-xs"></textarea>
          </details>

          <div class="mb-4 rounded border border-gray-800 bg-gray-950 p-3">
            <div class="flex items-center justify-between gap-3 mb-2">
              <div>
                <label class="label">Map Music</label>
                <p class="text-xs text-gray-500">Upload MP3, OGG, WAV, M4A, AAC, or FLAC. This track plays for games started on this map.</p>
              </div>
              <span v-if="form.music_name" class="text-xs text-amber-300 truncate max-w-64">{{ form.music_name }}</span>
            </div>
            <input type="file" accept="audio/*" class="input" @change="onMusicFile" />
            <label v-if="form.music_url" class="mt-2 flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" v-model="removeMusic" class="accent-red-500" />
              Remove existing music
            </label>
          </div>

          <div class="flex gap-3">
            <button type="submit" :disabled="saving" class="flex-1 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold py-2 rounded disabled:opacity-50">{{ saving ? 'Saving...' : 'Save Map' }}</button>
            <button type="button" @click="showForm = false" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';

const props = defineProps({ project: Object, maps: Array });
const emit = defineEmits(['updated']);

const showForm = ref(false);
const editing = ref(null);
const saving = ref(false);
const settingsText = ref('{}');
const musicFile = ref(null);
const removeMusic = ref(false);

const defaults = {
  scale: 0.006,
  mScale: 0.008,
  seaLevel: 0.38,
  mountainH: 0.72,
  riverCount: 5,
  forestThickness: 2,
  mineCount: 8,
  villageCount: 6,
  ruinsCount: 7,
  campCount: 5,
  specialCount: 2,
  maxPlayers: 4,
};

const numericFields = [
  { key: 'scale', label: 'Height Scale', min: 0.002, max: 0.02, step: 0.001 },
  { key: 'mScale', label: 'Moisture Scale', min: 0.002, max: 0.02, step: 0.001 },
  { key: 'seaLevel', label: 'Sea Level', min: 0.2, max: 0.6, step: 0.01 },
  { key: 'mountainH', label: 'Mountain Height', min: 0.55, max: 0.9, step: 0.01 },
  { key: 'riverCount', label: 'Rivers', min: 0, max: 16, step: 1 },
  { key: 'forestThickness', label: 'Forest Spread', min: 0, max: 6, step: 1 },
  { key: 'mineCount', label: 'Mines', min: 0, max: 24, step: 1 },
  { key: 'villageCount', label: 'Villages', min: 0, max: 24, step: 1 },
  { key: 'ruinsCount', label: 'Ruins', min: 0, max: 24, step: 1 },
  { key: 'campCount', label: 'Camps', min: 0, max: 24, step: 1 },
  { key: 'specialCount', label: 'Specials', min: 0, max: 12, step: 1 },
];

const blank = () => ({
  key: '',
  name: '',
  description: '',
  width: 128,
  height: 128,
  max_players: 4,
  procedural_settings: { ...defaults },
  music_path: null,
  music_name: null,
  music_url: null,
  is_default: false,
});

const form = reactive(blank());

watch(
  () => form.max_players,
  value => { form.procedural_settings.maxPlayers = value; },
);

watch(
  () => form.procedural_settings,
  value => { settingsText.value = JSON.stringify(value, null, 2); },
  { deep: true },
);

function setting(map, key) {
  return map.procedural_settings?.[key] ?? defaults[key] ?? '-';
}

function openForm(map) {
  editing.value = map;
  Object.assign(form, map ? {
    ...blank(),
    ...map,
    procedural_settings: { ...defaults, ...(map.procedural_settings || {}), maxPlayers: map.max_players ?? defaults.maxPlayers },
  } : blank());
  settingsText.value = JSON.stringify(form.procedural_settings, null, 2);
  musicFile.value = null;
  removeMusic.value = false;
  showForm.value = true;
}

function onMusicFile(event) {
  musicFile.value = event.target.files?.[0] || null;
  if (musicFile.value) removeMusic.value = false;
}

async function save() {
  try {
    form.procedural_settings = { ...defaults, ...JSON.parse(settingsText.value), maxPlayers: form.max_players };
  } catch {
    form.procedural_settings = { ...defaults, ...form.procedural_settings, maxPlayers: form.max_players };
  }

  saving.value = true;
  const url = editing.value ? `/projects/${props.project.id}/maps/${editing.value.id}` : `/projects/${props.project.id}/maps`;
  const body = new FormData();
  if (editing.value) body.append('_method', 'PATCH');
  for (const [key, value] of Object.entries(form)) {
    if (['music_path', 'music_name', 'music_url'].includes(key)) continue;
    body.append(key, key === 'procedural_settings' ? JSON.stringify(value || {}) : value ?? '');
  }
  body.append('remove_music', removeMusic.value ? '1' : '0');
  if (musicFile.value) body.append('music_file', musicFile.value);

  await fetch(url, {
    method: 'POST',
    headers: { 'X-CSRF-TOKEN': csrf() },
    body,
  });
  saving.value = false;
  showForm.value = false;
  emit('updated');
}

async function remove(map) {
  if (!confirm(`Delete map preset "${map.name}"? Existing saves will keep their copied settings.`)) return;
  await fetch(`/projects/${props.project.id}/maps/${map.id}`, { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } });
  emit('updated');
}

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';
</script>

<style scoped>
.label { display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.25rem; }
.input { width: 100%; background: #1f2937; border: 1px solid #4b5563; border-radius: 0.25rem; padding: 0.5rem 0.75rem; color: #fff; font-size: 0.875rem; outline: none; }
.input:focus { border-color: #f59e0b; }
.stat { display: flex; justify-content: space-between; gap: 0.5rem; background: #111827; border: 1px solid #1f2937; border-radius: 0.25rem; padding: 0.45rem 0.55rem; color: #9ca3af; }
.stat strong { color: #f3f4f6; font-variant-numeric: tabular-nums; }
</style>
