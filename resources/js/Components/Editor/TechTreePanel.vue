<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold text-white">Tech Tree</h2>
      <button @click="openForm(null)" class="bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold px-4 py-2 rounded text-sm">+ Add Tech</button>
    </div>

    <!-- Visual tree by era -->
    <div v-for="era in eras" :key="era" class="mb-8">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-800 pb-1">{{ era }}</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <div
          v-for="t in techsByEra[era]"
          :key="t.id"
          class="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-amber-600 transition"
        >
          <div class="flex items-start justify-between mb-1">
            <h4 class="font-semibold text-white text-sm">{{ t.name }}</h4>
            <div class="flex gap-1">
              <button @click="openForm(t)" class="text-xs text-gray-500 hover:text-white">✎</button>
              <button @click="remove(t)"   class="text-xs text-gray-500 hover:text-red-400">✕</button>
            </div>
          </div>
          <p class="text-xs text-gray-500 font-mono mb-2">{{ t.key }}</p>
          <p v-if="t.description" class="text-xs text-gray-400 mb-2 line-clamp-2">{{ t.description }}</p>
          <div class="text-xs text-yellow-400">{{ formatCost(t.cost) }}</div>
          <div v-if="(t.requirements||[]).length" class="text-xs text-blue-400 mt-1">Req: {{ (t.requirements||[]).join(', ') }}</div>
        </div>
      </div>
    </div>
    <div v-if="!techs?.length" class="text-center py-16 text-gray-500">No technologies defined yet.</div>

    <!-- Form Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 py-4 overflow-y-auto">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl mx-4">
        <h3 class="text-lg font-bold mb-4 text-amber-400">{{ editing ? 'Edit' : 'New' }} Technology</h3>
        <form @submit.prevent="save">
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div><label class="label">Key</label><input v-model="form.key" required class="input" placeholder="iron_working" /></div>
            <div><label class="label">Name</label><input v-model="form.name" required class="input" placeholder="Iron Working" /></div>
          </div>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="label">Era</label>
              <select v-model="form.era" class="input">
                <option v-for="e in ['ancient','medieval','renaissance','industrial']" :key="e" :value="e">{{ e }}</option>
              </select>
            </div>
            <div><label class="label">Research Time (s)</label><input v-model.number="form.research_time" type="number" min="1" class="input" /></div>
          </div>
          <div class="mb-3"><label class="label">Description</label><textarea v-model="form.description" rows="2" class="input resize-none"></textarea></div>
          <div class="mb-3">
            <label class="label">Cost</label>
            <div class="grid grid-cols-3 gap-2">
              <div v-for="r in ['gold','food','iron']" :key="r">
                <label class="text-xs text-gray-500 capitalize">{{ r }}</label>
                <input v-model.number="form.cost[r]" type="number" min="0" class="input text-xs py-1" />
              </div>
            </div>
          </div>
          <div class="mb-3"><label class="label">Prerequisite tech keys (comma-separated)</label><input v-model="reqText" type="text" placeholder="agriculture,basic_mining" class="input" /></div>
          <div class="mb-3">
            <label class="label">Effects (JSON)</label>
            <textarea v-model="effectsText" rows="3" placeholder='{"resource_bonus":{"food":0.2}}' class="input resize-none font-mono text-xs"></textarea>
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
import { ref, reactive, computed } from 'vue';

const props = defineProps({ project: Object, techs: Array, factions: Array });
const emit  = defineEmits(['updated']);

const showForm = ref(false);
const editing  = ref(null);
const saving   = ref(false);
const reqText     = ref('');
const effectsText = ref('{}');

const eras = ['ancient','medieval','renaissance','industrial'];
const techsByEra = computed(() => {
  const map = {};
  for (const e of eras) map[e] = (props.techs || []).filter(t => t.era === e);
  return map;
});

const blank = () => ({ key:'', name:'', era:'medieval', description:'', research_time:120, cost:{gold:100}, requirements:[], effects:{}, tree_x:0, tree_y:0 });
const form  = reactive(blank());

function formatCost(c) {
  if (!c) return ''; return Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>`${v} ${k}`).join(', ');
}

function openForm(t) {
  editing.value = t;
  Object.assign(form, t ? { ...blank(), ...t, cost: { ...blank().cost, ...(t.cost||{}) } } : blank());
  reqText.value     = ((t?.requirements)||[]).join(',');
  effectsText.value = JSON.stringify(t?.effects || {}, null, 2);
  showForm.value = true;
}

async function save() {
  form.requirements = reqText.value.split(',').map(s=>s.trim()).filter(Boolean);
  try { form.effects = JSON.parse(effectsText.value); } catch { form.effects = {}; }
  saving.value = true;
  const url    = editing.value ? `/projects/${props.project.id}/techs/${editing.value.id}` : `/projects/${props.project.id}/techs`;
  const method = editing.value ? 'PATCH' : 'POST';
  await fetch(url, { method, headers: { 'Content-Type':'application/json','X-CSRF-TOKEN':csrf() }, body: JSON.stringify(form) });
  saving.value = false; showForm.value = false; emit('updated');
}

async function remove(t) {
  if (!confirm(`Delete tech "${t.name}"?`)) return;
  await fetch(`/projects/${props.project.id}/techs/${t.id}`, { method:'DELETE', headers:{'X-CSRF-TOKEN':csrf()} });
  emit('updated');
}

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';
</script>

<style scoped>
.label { display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.25rem; }
.input { width: 100%; background: #1f2937; border: 1px solid #4b5563; border-radius: 0.25rem; padding: 0.5rem 0.75rem; color: #fff; font-size: 0.875rem; outline: none; }
.input:focus { border-color: #f59e0b; }
</style>
