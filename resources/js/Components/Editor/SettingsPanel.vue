<template>
  <div class="max-w-2xl">
    <h2 class="text-xl font-bold text-white mb-6">Project Settings</h2>
    <form @submit.prevent="save" class="space-y-6">
      <div>
        <label class="label">Project Name</label>
        <input v-model="form.name" required class="input" />
      </div>
      <div>
        <label class="label">Description</label>
        <textarea v-model="form.description" rows="3" class="input resize-none"></textarea>
      </div>

      <div class="border-t border-gray-800 pt-4">
        <h3 class="text-sm font-semibold text-gray-300 mb-3">Default Map Size</h3>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="label">Width (tiles)</label><input v-model.number="form.settings.map_width" type="number" min="64" max="256" class="input" /></div>
          <div><label class="label">Height (tiles)</label><input v-model.number="form.settings.map_height" type="number" min="64" max="256" class="input" /></div>
        </div>
      </div>

      <div>
        <h3 class="text-sm font-semibold text-gray-300 mb-3">Starting Resources (per faction)</h3>
        <div class="grid grid-cols-3 gap-3">
          <div v-for="r in ['gold','food','wood','stone','iron']" :key="r">
            <label class="label capitalize">{{ r }}</label>
            <input v-model.number="form.settings.starting_resources[r]" type="number" min="0" class="input" />
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-sm font-semibold text-gray-300 mb-3">Victory Conditions</h3>
        <div class="grid grid-cols-3 gap-2">
          <label v-for="vc in victoryConds" :key="vc" class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" :value="vc" v-model="form.settings.victory_conditions" class="accent-amber-500" />
            <span class="text-sm text-gray-300 capitalize">{{ vc }}</span>
          </label>
        </div>
      </div>

      <div>
        <label class="label">Max Players</label>
        <input v-model.number="form.settings.max_players" type="number" min="2" max="8" class="input w-32" />
      </div>

      <div class="flex gap-3 pt-2">
        <button type="submit" :disabled="saving" class="bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold px-6 py-2 rounded disabled:opacity-50">{{ saving ? 'Saving...' : 'Save Settings' }}</button>
      </div>
    </form>
    <p v-if="saved" class="text-green-400 text-sm mt-2">Settings saved!</p>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';

const props  = defineProps({ project: Object });
const emit   = defineEmits(['updated']);
const saving = ref(false);
const saved  = ref(false);

const defaultSettings = { map_width:128, map_height:128, starting_resources:{gold:500,food:200,wood:300,stone:100,iron:0}, victory_conditions:['wealth','military','territory'], max_players:4 };

const form = reactive({
  name:        props.project.name,
  description: props.project.description,
  settings:    { ...defaultSettings, ...(props.project.settings||{}), starting_resources: { ...defaultSettings.starting_resources, ...(props.project.settings?.starting_resources||{}) } },
});

const victoryConds = ['wealth','military','population','territory','prestige','scenario'];

async function save() {
  saving.value = true;
  await fetch(`/projects/${props.project.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type':'application/json','X-CSRF-TOKEN':csrf() },
    body: JSON.stringify({ name: form.name, description: form.description, settings: form.settings }),
  });
  saving.value = false; saved.value = true;
  setTimeout(() => saved.value = false, 2500);
  emit('updated');
}

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';
</script>

<style scoped>
.label { display: block; font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.25rem; }
.input { width: 100%; background: #1f2937; border: 1px solid #4b5563; border-radius: 0.25rem; padding: 0.5rem 0.75rem; color: #fff; font-size: 0.875rem; outline: none; }
.input:focus { border-color: #f59e0b; }
</style>
