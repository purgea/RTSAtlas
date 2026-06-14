<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-white">Units</h2>
        <p class="text-sm text-gray-400 mt-0.5">Configure unit stats, costs and abilities.</p>
      </div>
      <button @click="openForm(null)" class="bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold px-4 py-2 rounded text-sm">+ Add Unit</button>
    </div>

    <div class="overflow-x-auto rounded-lg border border-gray-800">
      <table class="w-full text-sm">
        <thead class="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
          <tr>
            <th class="px-4 py-2 text-left">Key</th>
            <th class="px-4 py-2 text-left">Sprite</th>
            <th class="px-4 py-2 text-left">Name</th>
            <th class="px-4 py-2 text-left">Category</th>
            <th class="px-4 py-2 text-right">HP</th>
            <th class="px-4 py-2 text-right">DMG</th>
            <th class="px-4 py-2 text-right">SPD</th>
            <th class="px-4 py-2 text-center">Atk</th>
            <th class="px-4 py-2 text-right">RNG</th>
            <th class="px-4 py-2 text-left">Cost</th>
            <th class="px-4 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800">
          <tr v-for="u in units" :key="u.id" class="bg-gray-900 hover:bg-gray-800/50 transition">
            <td class="px-4 py-2 font-mono text-amber-400 text-xs">{{ u.key }}</td>
            <td class="px-4 py-2"><span class="sprite-chip">{{ u.sprite || u.key }}</span></td>
            <td class="px-4 py-2 font-medium text-white">{{ u.name }}</td>
            <td class="px-4 py-2 text-gray-400 capitalize">{{ u.category }}</td>
            <td class="px-4 py-2 text-right text-green-400">{{ u.health }}</td>
            <td class="px-4 py-2 text-right text-red-400">{{ u.damage }}</td>
            <td class="px-4 py-2 text-right text-blue-400">{{ u.speed }}</td>
            <td class="px-4 py-2 text-center text-xs" :class="u.ranged_attack ? 'text-cyan-300' : 'text-gray-500'">{{ u.ranged_attack ? 'Ranged' : 'Melee' }}</td>
            <td class="px-4 py-2 text-right text-purple-400">{{ u.range }}</td>
            <td class="px-4 py-2 text-xs text-gray-400">{{ formatCost(u.cost) }}</td>
            <td class="px-4 py-2 text-center">
              <button @click="openForm(u)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded mr-1">Edit</button>
              <button @click="remove(u)" class="text-xs bg-red-900 hover:bg-red-700 px-2 py-0.5 rounded">Del</button>
            </td>
          </tr>
          <tr v-if="!units?.length"><td colspan="11" class="px-4 py-8 text-center text-gray-500">No units defined yet.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Form Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto py-4">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl mx-4">
        <h3 class="text-lg font-bold mb-4 text-amber-400">{{ editing ? 'Edit' : 'New' }} Unit</h3>
        <form @submit.prevent="save">
          <div class="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label class="label">Key (unique)</label>
              <input v-model="form.key" type="text" required placeholder="soldier" class="input" />
            </div>
            <div>
              <label class="label">Display Name</label>
              <input v-model="form.name" type="text" required placeholder="Soldier" class="input" />
            </div>
            <div>
              <label class="label">Category</label>
              <select v-model="form.category" class="input">
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-3 mb-3">
            <div><label class="label">Health</label><input v-model.number="form.health" type="number" min="1" class="input" /></div>
            <div><label class="label">Damage</label><input v-model.number="form.damage" type="number" min="0" class="input" /></div>
            <div><label class="label">Armor</label><input v-model.number="form.armor" type="number" min="0" class="input" /></div>
            <div><label class="label">Speed</label><input v-model.number="form.speed" type="number" min="0.1" step="0.1" class="input" /></div>
          </div>

          <div class="grid grid-cols-3 gap-3 mb-3">
            <div class="col-span-2">
              <label class="label">Sprite Style</label>
              <select v-model="form.sprite" class="input">
                <option value="">Auto from unit key/category</option>
                <option v-for="s in spritePresets" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div>
              <label class="label">Sprite Key</label>
              <input v-model="form.sprite" type="text" placeholder="heavy_tank" class="input" />
            </div>
          </div>
          <div class="grid grid-cols-4 gap-3 mb-3">
            <div><label class="label">Range (tiles)</label><input v-model.number="form.range" type="number" min="1" class="input" /></div>
            <div><label class="label">Sight</label><input v-model.number="form.sight" type="number" min="1" class="input" /></div>
            <div><label class="label">Train Time (s)</label><input v-model.number="form.training_time" type="number" min="1" class="input" /></div>
            <div>
              <label class="label">Color</label>
              <input v-model="form.color" type="color" class="w-full h-9 rounded border border-gray-600 bg-gray-800 cursor-pointer" />
            </div>
          </div>
          <label class="flex items-center gap-2 mb-3 cursor-pointer">
            <input v-model="form.ranged_attack" type="checkbox" class="w-4 h-4 accent-amber-500" />
            <span class="text-sm text-gray-300">Ranged attacker</span>
            <span class="text-xs text-gray-500">Unchecked units must fight in melee range.</span>
          </label>

          <div class="mb-3 border-t border-gray-700 pt-3">
            <label class="label mb-2">Resource Costs</label>
            <div class="grid grid-cols-4 gap-2">
              <div v-for="r in ['gold','food','wood','stone','iron']" :key="r">
                <label class="text-xs text-gray-500 capitalize">{{ r }}</label>
                <input v-model.number="form.cost[r]" type="number" min="0" :placeholder="r" class="input text-xs py-1" />
              </div>
            </div>
          </div>

          <div class="mb-3">
            <label class="label">Faction (optional)</label>
            <select v-model="form.faction_id" class="input">
              <option :value="null">All factions</option>
              <option v-for="f in factions" :key="f.id" :value="f.id">{{ f.name }}</option>
            </select>
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

const props = defineProps({ project: Object, units: Array, factions: Array });
const emit  = defineEmits(['updated']);

const showForm = ref(false);
const editing  = ref(null);
const saving   = ref(false);
const categories = ['worker','soldier','archer','knight','siege','scout','merchant','priest','citizen'];

const spritePresets = ['rifleman','grenadier','archer','engineer','worker','harvester','light_tank','heavy_tank','apc','artillery','siege'];
const blankForm = () => ({ key: '', name: '', category: 'soldier', health: 100, damage: 10, armor: 0, speed: 1.5, range: 1, ranged_attack: false, sight: 5, training_time: 30, sprite: '', color: '#ffffff', faction_id: null, cost: { gold: 50, food: 1 } });
const form = reactive(blankForm());

function formatCost(cost) {
  if (!cost) return '—';
  return Object.entries(cost).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ') || '—';
}

function openForm(u) {
  editing.value = u;
  Object.assign(form, u ? { ...blankForm(), ...u, cost: { ...blankForm().cost, ...(u.cost || {}) } } : blankForm());
  showForm.value = true;
}

async function save() {
  saving.value = true;
  const url    = editing.value ? `/projects/${props.project.id}/units/${editing.value.id}` : `/projects/${props.project.id}/units`;
  const method = editing.value ? 'PATCH' : 'POST';
  await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() }, body: JSON.stringify(form) });
  saving.value = false; showForm.value = false; emit('updated');
}

async function remove(u) {
  if (!confirm(`Delete unit "${u.name}"?`)) return;
  await fetch(`/projects/${props.project.id}/units/${u.id}`, { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } });
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
