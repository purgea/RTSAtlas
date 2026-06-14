<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-white">Buildings</h2>
        <p class="text-sm text-gray-400 mt-0.5">Configure all constructable structures.</p>
      </div>
      <button @click="openForm(null)" class="bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold px-4 py-2 rounded text-sm">+ Add Building</button>
    </div>

    <div class="overflow-x-auto rounded-lg border border-gray-800">
      <table class="w-full text-sm">
        <thead class="bg-gray-800 text-gray-400 text-xs uppercase">
          <tr>
            <th class="px-4 py-2 text-left">Key</th>
            <th class="px-4 py-2 text-left">Sprite</th>
            <th class="px-4 py-2 text-left">Name</th>
            <th class="px-4 py-2 text-left">Category</th>
            <th class="px-4 py-2 text-right">HP</th>
            <th class="px-4 py-2 text-right">Size</th>
            <th class="px-4 py-2 text-left">Production</th>
            <th class="px-4 py-2 text-left">Cost</th>
            <th class="px-4 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800">
          <tr v-for="b in buildings" :key="b.id" class="bg-gray-900 hover:bg-gray-800/50">
            <td class="px-4 py-2 font-mono text-amber-400 text-xs">{{ b.key }}</td>
            <td class="px-4 py-2"><span class="sprite-chip">{{ b.sprite || b.key }}</span></td>
            <td class="px-4 py-2 font-medium text-white">{{ b.name }}</td>
            <td class="px-4 py-2 text-gray-400 capitalize">{{ b.category }}</td>
            <td class="px-4 py-2 text-right text-green-400">{{ b.health }}</td>
            <td class="px-4 py-2 text-right text-gray-400">{{ b.size }}×{{ b.size }}</td>
            <td class="px-4 py-2 text-xs text-yellow-400">{{ formatObj(b.production) }}</td>
            <td class="px-4 py-2 text-xs text-gray-400">{{ formatObj(b.cost) }}</td>
            <td class="px-4 py-2 text-center">
              <button @click="openForm(b)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded mr-1">Edit</button>
              <button @click="remove(b)" class="text-xs bg-red-900 hover:bg-red-700 px-2 py-0.5 rounded">Del</button>
            </td>
          </tr>
          <tr v-if="!buildings?.length"><td colspan="9" class="px-4 py-8 text-center text-gray-500">No buildings defined.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Form Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 py-4 overflow-y-auto">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl mx-4">
        <h3 class="text-lg font-bold mb-4 text-amber-400">{{ editing ? 'Edit' : 'New' }} Building</h3>
        <form @submit.prevent="save">
          <div class="grid grid-cols-3 gap-3 mb-3">
            <div><label class="label">Key</label><input v-model="form.key" required class="input" placeholder="barracks" /></div>
            <div><label class="label">Name</label><input v-model="form.name" required class="input" placeholder="Barracks" /></div>
            <div>
              <label class="label">Category</label>
              <select v-model="form.category" class="input">
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-3 mb-3">
            <div><label class="label">Health</label><input v-model.number="form.health" type="number" min="1" class="input" /></div>
            <div><label class="label">Armor</label><input v-model.number="form.armor" type="number" min="0" class="input" /></div>
            <div><label class="label">Size (tiles)</label><input v-model.number="form.size" type="number" min="1" max="4" class="input" /></div>
            <div><label class="label">Build Time (s)</label><input v-model.number="form.build_time" type="number" min="1" class="input" /></div>
          </div>

          <div class="grid grid-cols-3 gap-3 mb-3">
            <div class="col-span-2">
              <label class="label">Sprite Style</label>
              <select v-model="form.sprite" class="input">
                <option value="">Auto from building key/category</option>
                <option v-for="s in spritePresets" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div>
              <label class="label">Sprite Key</label>
              <input v-model="form.sprite" type="text" placeholder="war_factory" class="input" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-3 border-t border-gray-700 pt-3">
            <div>
              <label class="label mb-2">Build Cost</label>
              <div class="grid grid-cols-2 gap-2">
                <div v-for="r in resources" :key="r">
                  <label class="text-xs text-gray-500 capitalize">{{ r }}</label>
                  <input v-model.number="form.cost[r]" type="number" min="0" class="input text-xs py-1" />
                </div>
              </div>
            </div>
            <div>
              <label class="label mb-2">Production / game-second</label>
              <div class="grid grid-cols-2 gap-2">
                <div v-for="r in resources" :key="r">
                  <label class="text-xs text-gray-500 capitalize">{{ r }}</label>
                  <input v-model.number="form.production[r]" type="number" min="0" step="0.1" class="input text-xs py-1" />
                </div>
              </div>
            </div>
          </div>

          <div class="mb-3">
            <label class="label">Trainable Units (comma-separated keys)</label>
            <input v-model="trainsText" type="text" placeholder="soldier,archer" class="input" />
          </div>

          <div class="mb-3">
            <label class="label">Services Provided (comma-separated, e.g. sanitation,faith)</label>
            <input v-model="providesText" type="text" placeholder="sanitation" class="input" />
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

const props   = defineProps({ project: Object, buildings: Array, factions: Array });
const emit    = defineEmits(['updated']);
const showForm = ref(false);
const editing  = ref(null);
const saving   = ref(false);

const categories = ['military','economy','civic','production','defence','religious','sanitation'];
const resources  = ['gold','food','wood','stone','iron','faith'];

const spritePresets = ['con_yard','command_hq','barracks','war_factory','refinery','power_plant','silo','radar','turret','tower','generic'];
const blank = () => ({ key:'', name:'', category:'economy', health:400, armor:3, size:2, build_time:60, faction_id:null, sprite:'', cost:{gold:100,wood:80}, production:{}, trains:[], provides:{} });
const form  = reactive(blank());
const trainsText  = ref('');
const providesText= ref('');

function formatObj(o) {
  if (!o) return '—';
  return Object.entries(o).filter(([,v]) => v > 0).map(([k,v]) => `${v}${k.slice(0,1).toUpperCase()}`).join(' ') || '—';
}

function openForm(b) {
  editing.value = b;
  const base = blank();
  if (b) {
    Object.assign(form, { ...base, ...b, cost: { ...base.cost, ...(b.cost||{}) }, production: { ...base.production, ...(b.production||{}) } });
    trainsText.value   = (b.trains || []).join(',');
    providesText.value = Object.keys(b.provides || {}).join(',');
  } else {
    Object.assign(form, base);
    trainsText.value = ''; providesText.value = '';
  }
  showForm.value = true;
}

async function save() {
  form.trains   = trainsText.value.split(',').map(s=>s.trim()).filter(Boolean);
  form.provides = Object.fromEntries(providesText.value.split(',').map(s=>s.trim()).filter(Boolean).map(k=>[k,1]));
  saving.value  = true;
  const url     = editing.value ? `/projects/${props.project.id}/buildings/${editing.value.id}` : `/projects/${props.project.id}/buildings`;
  const method  = editing.value ? 'PATCH' : 'POST';
  await fetch(url, { method, headers: { 'Content-Type':'application/json','X-CSRF-TOKEN':csrf() }, body: JSON.stringify(form) });
  saving.value = false; showForm.value = false; emit('updated');
}

async function remove(b) {
  if (!confirm(`Delete "${b.name}"?`)) return;
  await fetch(`/projects/${props.project.id}/buildings/${b.id}`, { method:'DELETE', headers:{'X-CSRF-TOKEN':csrf()} });
  emit('updated');
}

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';
</script>

<style scoped>
.label { display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.25rem; }
.input { width: 100%; background: #1f2937; border: 1px solid #4b5563; border-radius: 0.25rem; padding: 0.5rem 0.75rem; color: #fff; font-size: 0.875rem; outline: none; }
.input:focus { border-color: #f59e0b; }
.sprite-chip { display: inline-flex; max-width: 8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 1px solid #374151; border-radius: 0.25rem; padding: 0.125rem 0.375rem; color: #93c5fd; background: #111827; font-size: 0.7rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
</style>
