<template>
  <div>
    <h2 class="text-xl font-bold text-white mb-6">Resources</h2>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div v-for="r in resources" :key="r.id" class="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-3">
        <div class="w-8 h-8 rounded flex-shrink-0 grid place-items-center text-xs font-bold text-gray-950" :style="{ background: r.color }">{{ iconGlyph(r.icon || r.key) }}</div>
        <div>
          <p class="font-semibold text-white text-sm">{{ r.name }}</p>
          <p class="text-xs text-gray-500 font-mono">{{ r.key }}</p>
          <p class="text-xs text-blue-300 font-mono">{{ r.icon || 'auto icon' }}</p>
          <p class="text-xs text-gray-400">Max: {{ r.max_storage }}</p>
        </div>
        <button @click="openForm(r)" class="ml-auto text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">Edit</button>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl mx-4">
        <h3 class="text-lg font-bold mb-4 text-amber-400">Edit Resource</h3>
        <form @submit.prevent="save">
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div><label class="label">Key</label><input v-model="form.key" required class="input" /></div>
            <div><label class="label">Name</label><input v-model="form.name" required class="input" /></div>
          </div>
          <div class="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label class="label">Icon / Sprite Key</label>
              <input v-model="form.icon" class="input" placeholder="gold, ore, food" />
            </div>
            <div>
              <label class="label">Color</label>
              <input v-model="form.color" type="color" class="w-full h-9 rounded border border-gray-600 bg-gray-800 cursor-pointer" />
            </div>
            <div><label class="label">Max Storage</label><input v-model.number="form.max_storage" type="number" min="1" class="input" /></div>
          </div>
          <label class="flex items-center gap-2 mb-4 cursor-pointer">
            <input v-model="form.affects_population" type="checkbox" class="w-4 h-4 accent-amber-500" />
            <span class="text-sm text-gray-300">Affects population</span>
          </label>
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
import { reactive, ref } from 'vue';

const props = defineProps({ project: Object, resources: Array });
const emit = defineEmits(['updated']);

const showForm = ref(false);
const saving = ref(false);
const editing = ref(null);
const form = reactive({ key: '', name: '', icon: '', color: '#ffd700', max_storage: 9999, affects_population: false });

function iconGlyph(icon) {
  const key = String(icon || '').toLowerCase();
  if (key.includes('gold') || key.includes('coin')) return '$';
  if (key.includes('food')) return 'F';
  if (key.includes('wood')) return 'W';
  if (key.includes('stone')) return 'S';
  if (key.includes('iron') || key.includes('ore')) return 'I';
  if (key.includes('faith')) return '+';
  if (key.includes('prestige')) return '*';
  return key.slice(0, 1).toUpperCase() || '?';
}

function openForm(resource) {
  editing.value = resource;
  Object.assign(form, {
    key: resource.key,
    name: resource.name,
    icon: resource.icon || '',
    color: resource.color || '#ffd700',
    max_storage: resource.max_storage || 9999,
    affects_population: !!resource.affects_population,
  });
  showForm.value = true;
}

async function save() {
  if (!editing.value) return;
  saving.value = true;
  await fetch(`/projects/${props.project.id}/resources/${editing.value.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
    body: JSON.stringify(form),
  });
  saving.value = false;
  showForm.value = false;
  emit('updated');
}

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';
</script>

<style scoped>
.label { display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.25rem; }
.input { width: 100%; background: #1f2937; border: 1px solid #4b5563; border-radius: 0.25rem; padding: 0.5rem 0.75rem; color: #fff; font-size: 0.875rem; outline: none; }
.input:focus { border-color: #f59e0b; }
</style>
