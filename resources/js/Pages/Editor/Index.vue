<template>
  <div class="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-52 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
      <div class="px-4 py-3 border-b border-gray-800">
        <button @click="goHome" class="text-xs text-gray-500 hover:text-gray-300 transition mb-1">← Back</button>
        <h2 class="font-bold text-amber-400 text-sm truncate">{{ project.name }}</h2>
        <p class="text-xs text-gray-500">Editor</p>
      </div>

      <nav class="flex-1 py-2 overflow-y-auto">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key"
          :class="['w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition',
            activeTab === tab.key ? 'bg-amber-600/20 text-amber-300 border-r-2 border-amber-500' : 'text-gray-400 hover:text-white hover:bg-gray-800'
          ]"
        >
          <span>{{ tab.icon }}</span> {{ tab.label }}
        </button>
      </nav>

      <div class="p-3 border-t border-gray-800">
        <p class="text-xs text-gray-600">{{ project.factions?.length ?? 0 }} factions</p>
        <p class="text-xs text-gray-600">{{ project.unit_configs?.length ?? 0 }} units</p>
        <p class="text-xs text-gray-600">{{ project.building_configs?.length ?? 0 }} buildings</p>
      </div>
    </aside>

    <!-- Content -->
    <main class="flex-1 overflow-auto p-6">
      <FactionsPanel
        v-if="activeTab === 'factions'"
        :project="project"
        :factions="project.factions"
        @updated="reloadProject"
      />
      <UnitsPanel
        v-else-if="activeTab === 'units'"
        :project="project"
        :units="project.unit_configs"
        :factions="project.factions"
        @updated="reloadProject"
      />
      <BuildingsPanel
        v-else-if="activeTab === 'buildings'"
        :project="project"
        :buildings="project.building_configs"
        :factions="project.factions"
        @updated="reloadProject"
      />
      <TechTreePanel
        v-else-if="activeTab === 'techs'"
        :project="project"
        :techs="project.tech_configs"
        :factions="project.factions"
        @updated="reloadProject"
      />
      <EventsPanel
        v-else-if="activeTab === 'events'"
        :project="project"
        :events="project.event_configs"
        @updated="reloadProject"
      />
      <ResourcesPanel
        v-else-if="activeTab === 'resources'"
        :project="project"
        :resources="project.resource_configs"
        @updated="reloadProject"
      />
      <SettingsPanel
        v-else-if="activeTab === 'settings'"
        :project="project"
        @updated="reloadProject"
      />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { router } from '@inertiajs/vue3';
import FactionsPanel  from '../../Components/Editor/FactionsPanel.vue';
import UnitsPanel     from '../../Components/Editor/UnitsPanel.vue';
import BuildingsPanel from '../../Components/Editor/BuildingsPanel.vue';
import TechTreePanel  from '../../Components/Editor/TechTreePanel.vue';
import EventsPanel    from '../../Components/Editor/EventsPanel.vue';
import ResourcesPanel from '../../Components/Editor/ResourcesPanel.vue';
import SettingsPanel  from '../../Components/Editor/SettingsPanel.vue';

const props = defineProps({ project: Object });
const activeTab = ref('factions');

const tabs = [
  { key: 'factions',  label: 'Factions',   icon: '🏰' },
  { key: 'units',     label: 'Units',       icon: '⚔️' },
  { key: 'buildings', label: 'Buildings',   icon: '🏗' },
  { key: 'techs',     label: 'Tech Tree',   icon: '🔬' },
  { key: 'events',    label: 'Events',      icon: '⚡' },
  { key: 'resources', label: 'Resources',   icon: '💰' },
  { key: 'settings',  label: 'Settings',    icon: '⚙️' },
];

function goHome()       { router.visit('/'); }
function reloadProject(){ router.reload({ preserveScroll: true }); }
</script>
