<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Map, View } from 'ol'
import DataCabinet from './DataCabinet.vue'
import Snackbar from './Snackbar.vue'
import createS2GridLayer from '../layers/S2-Grid-Layer'
import createCloudlessLayer from '../layers/S2-Cloudless-Layer'
// @ts-expect-error - No declaration file found
import Drag from '../functions/drag-interaction.js'
import { defaults as defaultInteractions } from 'ol/interaction/defaults.js'
import { generateJWT } from '../functions/generate-jwt'

const map = ref<Map | null>(null)
const dataCabinetRef = ref<InstanceType<typeof DataCabinet> | null>(null)
const areaValues = ref<{ min_area_km2: number; max_area_km2: number } | null>(null)

onMounted(async () => {
  map.value = new Map({
    interactions: defaultInteractions().extend([new Drag()]),
    target: 'map',
    layers: [createCloudlessLayer()],
    view: new View({
      center: [0, 0],
      zoom: 2,
    }),
  })

  // Get area values from API
  try {
    const token = generateJWT()
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
    const response = await fetch(`${apiBaseUrl}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch area values: ${response.statusText}`)
    }
    const data = await response.json()
    areaValues.value = {
      min_area_km2: data.min_area_km2 ?? 100,
      max_area_km2: data.max_area_km2 ?? 500,
    }
  } catch (error) {
    areaValues.value = {
      min_area_km2: 500,
      max_area_km2: 100,
    }
    console.error('Error fetching area values:', error)
  }

  // Add S2 Grid layer after map is initialized
  if (map.value) {
    const s2GridLayer = createS2GridLayer(map.value as Map, dataCabinetRef, areaValues.value)
    map.value.addLayer(s2GridLayer)
  }
})
</script>

<template>
  <div class="map-wrapper">
    <div id="map" class="map-container"></div>
    <DataCabinet v-if="map" :map="map as Map" ref="dataCabinetRef" />
    <Snackbar />
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
