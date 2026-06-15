<template>
  <div class="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
    <!-- Header -->
    <header class="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-amber-500 rounded flex items-center justify-center font-bold text-gray-900 text-sm">R</div>
        <h1 class="text-xl font-bold text-amber-400 tracking-wide">RTSAtlas Engine</h1>
        <span class="text-xs text-gray-500 ml-2">v1.0</span>
      </div>
      <button
        @click="showNewProject = true"
        class="bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold px-4 py-2 rounded transition text-sm"
      >
        + New Project
      </button>
    </header>

    <main class="flex-1 px-6 py-8">
      <div v-if="projects.length === 0" class="text-center py-24 text-gray-500">
        <div class="text-6xl mb-4">⚔️</div>
        <p class="text-xl mb-2">No projects yet</p>
        <p class="text-sm">Create a new project to start building your RTS world</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="project in projects"
          :key="project.id"
          class="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-amber-600 transition group"
        >
          <div class="h-1.5 bg-amber-600"></div>
          <div class="p-5">
            <div class="flex items-start justify-between mb-2">
              <h2 class="font-semibold text-lg text-white group-hover:text-amber-300 transition">
                {{ project.name }}
              </h2>
              <div class="flex gap-1 ml-2">
                <button @click="openEditor(project)" class="text-xs bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded">Edit</button>
                <button @click="confirmDelete(project)" class="text-xs bg-red-900 hover:bg-red-700 px-2 py-1 rounded">Del</button>
              </div>
            </div>
            <p class="text-gray-400 text-sm mb-4 line-clamp-2">{{ project.description || 'No description' }}</p>
            <div class="flex items-center gap-4 text-xs text-gray-500 mb-4">
              <span>{{ project.factions_count }} faction(s)</span>
              <span>{{ project.game_sessions_count }} save(s)</span>
            </div>
            <div class="flex gap-2">
              <button @click="startNewGame(project)" class="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded transition">▶ Play</button>
              <button v-if="project.game_sessions_count > 0" @click="loadGame(project)" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded transition">Load</button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- New Project Modal -->
    <div v-if="showNewProject" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 class="text-lg font-bold mb-4 text-amber-400">Create New Project</h2>
        <form @submit.prevent="submitNewProject">
          <div class="mb-4">
            <label class="block text-sm text-gray-400 mb-1">Project Name</label>
            <input v-model="form.name" type="text" required placeholder="My Kingdom..." class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-amber-500" />
          </div>
          <div class="mb-6">
            <label class="block text-sm text-gray-400 mb-1">Description (optional)</label>
            <textarea v-model="form.description" rows="3" placeholder="A medieval kingdom RTS..." class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none"></textarea>
          </div>
          <div class="flex gap-3">
            <button type="submit" :disabled="!form.name || submitting" class="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 font-bold py-2 rounded transition">
              {{ submitting ? 'Creating...' : 'Create Project' }}
            </button>
            <button type="button" @click="showNewProject = false" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Start Game Modal -->
    <div v-if="showStartGame" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 class="text-lg font-bold mb-4 text-green-400">Start New Game</h2>
        <form @submit.prevent="submitStartGame">
          <div class="mb-3">
            <label class="block text-sm text-gray-400 mb-1">Save Name</label>
            <input v-model="gameForm.name" type="text" required placeholder="Campaign 1" class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500" />
          </div>
          <div class="mb-3">
            <label class="block text-sm text-gray-400 mb-1">Seed (blank = random)</label>
            <input v-model="gameForm.seed" type="number" placeholder="12345678" class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500" />
          </div>
          <div class="mb-6">
            <label class="block text-sm text-gray-400 mb-2">Map Preset</label>
            <div v-if="selectedProjectMaps.length" class="space-y-2 max-h-72 overflow-y-auto">
              <label
                v-for="map in selectedProjectMaps"
                :key="map.id"
                :class="['block cursor-pointer rounded border p-3 transition', gameForm.map_config_id === map.id ? 'border-green-500 bg-green-950/40' : 'border-gray-700 bg-gray-800 hover:border-gray-500']"
              >
                <input v-model.number="gameForm.map_config_id" type="radio" :value="map.id" class="sr-only" />
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-semibold text-white">{{ map.name }}</p>
                    <p class="text-xs text-gray-400 mt-1">{{ map.width }} x {{ map.height }} · {{ map.max_players }} players</p>
                  </div>
                  <span v-if="map.is_default" class="text-xs text-green-300 bg-green-900 px-2 py-0.5 rounded">Default</span>
                </div>
                <p v-if="map.description" class="text-xs text-gray-500 mt-2">{{ map.description }}</p>
              </label>
            </div>
            <div v-else class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-400 mb-1">Map Width</label>
                <select v-model.number="gameForm.map_width" class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white">
                  <option :value="64">64 (Small)</option>
                  <option :value="96">96 (Medium)</option>
                  <option :value="128">128 (Large)</option>
                  <option :value="192">192 (Huge)</option>
                </select>
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">Map Height</label>
                <select v-model.number="gameForm.map_height" class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white">
                  <option :value="64">64 (Small)</option>
                  <option :value="96">96 (Medium)</option>
                  <option :value="128">128 (Large)</option>
                  <option :value="192">192 (Huge)</option>
                </select>
              </div>
            </div>
          </div>
          <div class="flex gap-3">
            <button type="submit" class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded transition">Launch Game</button>
            <button type="button" @click="showStartGame = false" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Load Game Modal -->
    <div v-if="showLoadGame" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl">
        <h2 class="text-lg font-bold mb-4 text-blue-400">Load Save</h2>
        <div v-if="loadingSessions" class="text-center py-8 text-gray-400">Loading...</div>
        <div v-else-if="sessions.length === 0" class="text-center py-8 text-gray-500">No saves found.</div>
        <div v-else class="space-y-2 max-h-80 overflow-y-auto mb-4">
          <div v-for="s in sessions" :key="s.id" @click="openSession(s)" class="cursor-pointer bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded p-3 flex items-center justify-between">
            <div>
              <p class="font-medium text-white">{{ s.name }}</p>
              <p class="text-xs text-gray-400">Year {{ s.game_year }} · Tick {{ s.tick }}</p>
            </div>
            <span class="text-xs text-gray-500">{{ formatDate(s.updated_at) }}</span>
          </div>
        </div>
        <button @click="showLoadGame = false" class="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { router } from '@inertiajs/vue3';

const props = defineProps({ projects: { type: Array, default: () => [] } });

const showNewProject  = ref(false);
const showStartGame   = ref(false);
const showLoadGame    = ref(false);
const submitting      = ref(false);
const sessions        = ref([]);
const loadingSessions = ref(false);
const selectedProject = ref(null);

const form     = reactive({ name: '', description: '' });
const gameForm = reactive({ name: 'Campaign 1', seed: '', map_config_id: null, map_width: 128, map_height: 128 });

const selectedProjectMaps = computed(() => selectedProject.value?.map_configs || []);

function submitNewProject() {
  submitting.value = true;
  router.post('/projects', form, {
    onFinish: () => {
      submitting.value = false;
      showNewProject.value = false;
      Object.assign(form, { name: '', description: '' });
    },
  });
}

function openEditor(project) { router.visit(`/editor/${project.id}`); }

function startNewGame(project) {
  selectedProject.value = project;
  gameForm.name = `${project.name} - Save 1`;
  const maps = project.map_configs || [];
  const map = maps.find(m => m.is_default) || maps[0] || null;
  gameForm.map_config_id = map?.id ?? null;
  gameForm.map_width = map?.width ?? project.settings?.map_width ?? 128;
  gameForm.map_height = map?.height ?? project.settings?.map_height ?? 128;
  showStartGame.value = true;
}

function submitStartGame() {
  router.post(`/projects/${selectedProject.value.id}/sessions`, gameForm, {
    onFinish: () => { showStartGame.value = false; },
  });
}

async function loadGame(project) {
  selectedProject.value = project;
  showLoadGame.value    = true;
  loadingSessions.value = true;
  const res = await fetch(`/projects/${project.id}/sessions`);
  sessions.value        = await res.json();
  loadingSessions.value = false;
}

function openSession(session) { router.visit(`/play/${session.id}`); }

function confirmDelete(project) {
  if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
    router.delete(`/projects/${project.id}`);
  }
}

function formatDate(dt) { return dt ? new Date(dt).toLocaleDateString() : ''; }
</script>
