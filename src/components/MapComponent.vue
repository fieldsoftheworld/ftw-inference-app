<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Map, View } from 'ol'
import DataCabinet from './DataCabinet.vue'
import createS2GridLayer from '../layers/S2-Grid-Layer.ts'
import createCloudlessLayer from '../layers/S2-Cloudless-Layer.ts'
import Drag from '../functions/drag-interaction.js'
import { defaults as defaultInteractions } from 'ol/interaction/defaults.js'

const map = ref<Map | null>(null)
const dataCabinetRef = ref<InstanceType<typeof DataCabinet> | null>(null)

onMounted(() => {
  map.value = new Map({
    interactions: defaultInteractions().extend([new Drag()]),
    target: 'map',
    layers: [createCloudlessLayer()],
    view: new View({
      center: [0, 0],
      zoom: 2,
    }),
  })

  // Add S2 Grid layer after map is initialized
  if (map.value) {
    const s2GridLayer = createS2GridLayer(map.value, dataCabinetRef)
    map.value.addLayer(s2GridLayer)
  }
})

// Expose methods to parent components
defineExpose({})
</script>

<template>
  <div class="map-wrapper">
    <div id="map" class="map-container"></div>
    <DataCabinet :map="map" ref="dataCabinetRef" />
  </div>
</template>

<style scoped>
.map-wrapper {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
}

.map-container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
}

:deep(.ol-zoom) {
  top: unset;
  bottom: 0.625rem;
  left: 0.625rem;
}

:deep(.ol-zoom button) {
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
}

:deep(.ol-zoom button:hover) {
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
}

:deep(.ol-attribution button) {
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
}

:deep(.ol-attribution) {
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
}

:deep(.ol-attribution ul) {
  color: #fff;
  font-size: 0.875rem;
  text-shadow: none;
}

:deep(.ol-attribution ul li a) {
  color: #fff;
}
</style>
