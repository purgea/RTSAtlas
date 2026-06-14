<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-white">Factions</h2>
        <p class="text-sm text-gray-400 mt-0.5">Define the civilisations in your game.</p>
      </div>
      <button @click="openForm(null)" class="bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold px-4 py-2 rounded text-sm">+ Add Faction</button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div v-for="f in factions" :key="f.id" class="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-start gap-4">
        <div class="w-10 h-10 rounded-full flex-shrink-0 border-2 border-gray-700" :style="{ background: f.color }"></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="font-semibold text-white truncate">{{ f.name }}</h3>
            <span :class="f.playable ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'" class="text-xs px-2 py-0.5 rounded-full">{{ f.playable ? 'Player' : 'AI' }}</span>
          </div>
          <p class="text-xs text-gray-400 truncate mb-2">{{ f.description || 'No description' }}</p>
          <div class="flex gap-1.5 text-xs">
            <span v-if="f.ai_profile?.aggression !== undefined" class="bg-red-900/60 text-red-300 px-2 py-0.5 rounded">Aggr {{ pct(f.ai_profile.aggression) }}</span>
            <span v-if="f.ai_profile?.economy !== undefined" class="bg-yellow-900/60 text-yellow-300 px-2 py-0.5 rounded">Econ {{ pct(f.ai_profile.economy) }}</span>
          </div>
        </div>
        <div class="flex gap-1 flex-shrink-0">
          <button @click="openForm(f)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">Edit</button>
          <button @click="remove(f)" class="text-xs bg-red-900 hover:bg-red-700 px-2 py-1 rounded">Del</button>
        </div>
      </div>
    </div>

    <!-- Form Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl">
        <h3 class="text-lg font-bold mb-4 text-amber-400">{{ editing ? 'Edit' : 'New' }} Faction</h3>
        <form @submit.prevent="save">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="label">Name</label>
              <input v-model="form.name" type="text" required class="input" />
            </div>
            <div>
              <label class="label">Color</label>
              <input v-model="form.color" type="color" class="w-full h-10 rounded border border-gray-600 bg-gray-800 cursor-pointer" />
            </div>
          </div>
          <div class="mb-4">
            <label class="label">Description</label>
            <textarea v-model="form.description" rows="2" class="input resize-none"></textarea>
          </div>
          <div class="mb-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.playable" type="checkbox" class="w-4 h-4 accent-amber-500" />
              <span class="text-sm text-gray-300">Player-controllable faction</span>
            </label>
          </div>
          <div class="mb-4 border-t border-gray-700 pt-4">
            <p class="text-sm font-medium text-gray-300 mb-3">AI Profile</p>
            <div class="grid grid-cols-3 gap-3">
              <div v-for="key in ['aggression','expansion','economy']" :key="key">
                <label class="label capitalize">{{ key }}</label>
                <input v-model.number="form.ai_profile[key]" type="range" min="0" max="1" step="0.05" class="w-full accent-amber-500" />
                <span class="text-xs text-gray-400">{{ pct(form.ai_profile[key]) }}</span>
              </div>
            </div>
          </div>
          <div class="flex gap-3">
            <button type="submit" :disabled="saving" class="flex-1 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold py-2 rounded disabled:opacity-50">{{ saving ? 'Saving...' : 'Save' }}</button>
            <button type="button" @click="showForm = false" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';

const props = defineProps({ project: Object, factions: Array });
const emit  = defineEmits(['updated']);

const showForm = ref(false);
const editing  = ref(null);
const saving   = ref(false);
const form     = reactive({ name: '', color: '#4169e1', description: '', playable: true, ai_profile: { aggression: 0.5, expansion: 0.5, economy: 0.5 }, bonuses: {} });

function pct(v) { return Math.round((v ?? 0) * 100) + '%'; }

function openForm(f) {
  editing.value = f;
  if (f) {
    Object.assign(form, { ...f, ai_profile: { ...{ aggression: 0.5, expansion: 0.5, economy: 0.5 }, ...(f.ai_profile || {}) } });
  } else {
    Object.assign(form, { name: '', color: '#4169e1', description: '', playable: true, ai_profile: { aggression: 0.5, expansion: 0.5, economy: 0.5 }, bonuses: {} });
  }
  showForm.value = true;
}

async function save() {
  saving.value = true;
  const url    = editing.value
    ? `/projects/${props.project.id}/factions/${editing.value.id}`
    : `/projects/${props.project.id}/factions`;
  const method = editing.value ? 'PATCH' : 'POST';

  await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrf() },
    body: JSON.stringify(form),
  });
  saving.value   = false;
  showForm.value = false;
  emit('updated');
}

async function remove(f) {
  if (!confirm(`Delete faction "${f.name}"?`)) return;
  await fetch(`/projects/${props.project.id}/factions/${f.id}`, {
    method: 'DELETE',
    headers: { 'X-CSRF-TOKEN': getCsrf() },
  });
  emit('updated');
}

function getCsrf() { return document.querySelector('meta[name="csrf-token"]')?.content ?? ''; }
</script>

<style scoped>
.label { display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.25rem; }
.input { width: 100%; background: #1f2937; border: 1px solid #4b5563; border-radius: 0.25rem; padding: 0.5rem 0.75rem; color: #fff; font-size: 0.875rem; outline: none; }
.input:focus { border-color: #f59e0b; }
</style>
