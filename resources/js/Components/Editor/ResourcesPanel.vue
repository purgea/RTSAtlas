<template>
  <div>
    <h2 class="text-xl font-bold text-white mb-6">Resources</h2>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div v-for="r in resources" :key="r.id" class="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-3">
        <div class="w-8 h-8 rounded-full flex-shrink-0" :style="{ background: r.color }"></div>
        <div>
          <p class="font-semibold text-white text-sm">{{ r.name }}</p>
          <p class="text-xs text-gray-500 font-mono">{{ r.key }}</p>
          <p class="text-xs text-gray-400">Max: {{ r.max_storage }}</p>
        </div>
      </div>
    </div>
    <p class="text-xs text-gray-500 mt-4">Resources are seeded when the project is created. Custom resources can be added via the API.</p>
  </div>
</template>

<script setup>
defineProps({ project: Object, resources: Array });
</script>
