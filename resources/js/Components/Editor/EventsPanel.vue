<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold text-white">World Events</h2>
      <button @click="openForm(null)" class="bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold px-4 py-2 rounded text-sm">+ Add Event</button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div v-for="e in events" :key="e.id" class="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div class="flex items-start justify-between mb-2">
          <div>
            <span :class="typeClass(e.type)" class="text-xs px-2 py-0.5 rounded-full mr-2">{{ e.type }}</span>
            <span class="font-semibold text-white">{{ e.name }}</span>
          </div>
          <div class="flex gap-1">
            <button @click="openForm(e)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">Edit</button>
            <button @click="remove(e)"   class="text-xs bg-red-900 hover:bg-red-700 px-2 py-1 rounded">Del</button>
          </div>
        </div>
        <p class="text-xs text-gray-400 mb-2">{{ e.description || '—' }}</p>
        <div class="flex gap-3 text-xs text-gray-500">
          <span>Every: {{ formatInterval(e.interval_seconds) }}</span>
          <span>Duration: {{ e.duration > 0 ? e.duration + 's' : 'Instant' }}</span>
          <span v-if="(e.choices||[]).length">{{ e.choices.length }} choice(s)</span>
        </div>
      </div>
    </div>
    <div v-if="!events?.length" class="text-center py-16 text-gray-500">No events defined yet.</div>

    <!-- Form Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 py-4 overflow-y-auto">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl mx-4">
        <h3 class="text-lg font-bold mb-4 text-amber-400">{{ editing ? 'Edit' : 'New' }} Event</h3>
        <form @submit.prevent="save">
          <div class="grid grid-cols-3 gap-3 mb-3">
            <div><label class="label">Key</label><input v-model="form.key" required class="input" placeholder="plague_outbreak" /></div>
            <div><label class="label">Name</label><input v-model="form.name" required class="input" placeholder="Plague Outbreak" /></div>
            <div>
              <label class="label">Type</label>
              <select v-model="form.type" class="input">
                <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
          </div>
          <div class="mb-3"><label class="label">Description</label><textarea v-model="form.description" rows="3" class="input resize-none"></textarea></div>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div><label class="label">Trigger Every (seconds)</label><input v-model.number="form.interval_seconds" type="number" min="1" class="input" /></div>
            <div><label class="label">Duration (seconds, 0=instant)</label><input v-model.number="form.duration" type="number" min="0" class="input" /></div>
          </div>
          <div class="mb-3">
            <label class="label">Effects (JSON) — e.g. immediate resource deltas</label>
            <textarea v-model="effectsText" rows="4" placeholder='{"immediate":{"food":-100,"gold":-50}}' class="input resize-none font-mono text-xs"></textarea>
          </div>
          <div class="mb-3">
            <label class="label">Player Choices (JSON array)</label>
            <textarea v-model="choicesText" rows="4" placeholder='[{"label":"Pay tribute","consequences":{"gold":-200}},{"label":"Refuse","consequences":{"prestige":-20}}]' class="input resize-none font-mono text-xs"></textarea>
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

const props = defineProps({ project: Object, events: Array });
const emit  = defineEmits(['updated']);
const showForm = ref(false);
const editing  = ref(null);
const saving   = ref(false);
const effectsText = ref('{}');
const choicesText = ref('[]');

const types = ['disease','bandit','drought','flood','fire','famine','discovery','rebellion','religious','economic_boom','plague','invasion'];

const typeClass = (t) => ({
  disease:'bg-green-900 text-green-300', bandit:'bg-red-900 text-red-300',
  drought:'bg-yellow-900 text-yellow-300', flood:'bg-blue-900 text-blue-300',
  fire:'bg-orange-900 text-orange-300', famine:'bg-amber-900 text-amber-300',
  discovery:'bg-teal-900 text-teal-300',
})[t] || 'bg-gray-700 text-gray-300';

const blank = () => ({ key:'', name:'', type:'disease', description:'', interval_seconds:300, duration:0, effects:{}, choices:[] });
const form  = reactive(blank());

function formatInterval(seconds) {
  const s = Number(seconds || 300);
  if (s >= 60 && s % 60 === 0) return `${s / 60} min`;
  return `${s}s`;
}

function openForm(e) {
  editing.value = e;
  Object.assign(form, e ? { ...blank(), ...e } : blank());
  effectsText.value = JSON.stringify(e?.effects  || {}, null, 2);
  choicesText.value = JSON.stringify(e?.choices  || [], null, 2);
  showForm.value = true;
}

async function save() {
  try { form.effects = JSON.parse(effectsText.value); } catch { form.effects = {}; }
  try { form.choices = JSON.parse(choicesText.value); } catch { form.choices = []; }
  saving.value = true;
  const url    = editing.value ? `/projects/${props.project.id}/events/${editing.value.id}` : `/projects/${props.project.id}/events`;
  const method = editing.value ? 'PATCH' : 'POST';
  await fetch(url, { method, headers:{'Content-Type':'application/json','X-CSRF-TOKEN':csrf()}, body:JSON.stringify(form) });
  saving.value = false; showForm.value = false; emit('updated');
}

async function remove(e) {
  if (!confirm(`Delete event "${e.name}"?`)) return;
  await fetch(`/projects/${props.project.id}/events/${e.id}`, { method:'DELETE', headers:{'X-CSRF-TOKEN':csrf()} });
  emit('updated');
}

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';
</script>

<style scoped>
.label { display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.25rem; }
.input { width: 100%; background: #1f2937; border: 1px solid #4b5563; border-radius: 0.25rem; padding: 0.5rem 0.75rem; color: #fff; font-size: 0.875rem; outline: none; }
.input:focus { border-color: #f59e0b; }
</style>
