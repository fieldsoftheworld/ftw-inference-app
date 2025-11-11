<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Map, View } from 'ol'
import DataCabinet from './DataCabinet.vue'
import ProcessingResults from './ProcessingResults.vue'
import PropertyDisplay from './PropertyDisplay.vue'
import createLabelLayer from '../layers/Label-Layer'
import createS2GridLayer from '../layers/S2-Grid-Layer'
import createCloudlessLayer from '../layers/S2-Cloudless-Layer'
import { generateJWT } from '../functions/generate-jwt'
import { useAreaOfInterest } from '../composables/useAreaOfInterest'
import { useSearch } from '../composables/useSearch'
import { usePermalink } from '../composables/usePermalink'
import { useMap } from '../composables/useMap'
import { useSnackbar } from '../composables/useSnackbar'
import { setAvailableModels } from '../composables/useSettings'

const {
  map,
  areaValues,
  showPropertiesBox,
  selectedFeature,
  propertiesBoxPosition,
  originalClickPosition,
  hidePropertiesBox,
} = useMap()
const dataCabinetRef = ref<InstanceType<typeof DataCabinet> | null>(null)
const geoJSONResults = ref<any[]>([])

const { addMapClickHandler } = useAreaOfInterest()
const { handleSearchResults } = useSearch()
const { setupPermalink } = usePermalink()
const { messages, showCritical } = useSnackbar()

const updateGeoJSONResults = (results: any[]) => {
  geoJSONResults.value = results
}

const clearResults = () => {
  geoJSONResults.value = []
}

onMounted(async () => {
  map.value = new Map({
    target: 'map',
    layers: [createCloudlessLayer(), createLabelLayer()],
    view: new View({
      center: [0, 0],
      zoom: 2,
    }),
  })

  // Get area values and models from API
  try {
    const token = generateJWT()
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
    const response = await fetch(`${apiBaseUrl}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await response.json()
    if (!response.ok) {
      const error = data?.detail || response.statusText
      showCritical(`Can't connect to server: ${error}`)
    }
    areaValues.value = {
      min_area_km2: data.min_area_km2 ?? 100,
      max_area_km2: data.max_area_km2 ?? 500,
    }

    // Set available models if they exist in the response
    if (data.models && Array.isArray(data.models)) {
      setAvailableModels(data.models)
    }
  } catch (error) {
    areaValues.value = {
      min_area_km2: 500,
      max_area_km2: 100,
    }
    showCritical(`Can't connect to server: ${error.message}`)
  }

  // Add S2 Grid layer after map is initialized
  if (map.value) {
    const s2GridLayer = createS2GridLayer()
    addMapClickHandler(map.value as Map, areaValues.value, handleSearchResults)
    map.value.addLayer(s2GridLayer)

    // Setup permalink functionality
    setupPermalink()
  }
})

// Expose methods to parent components
defineExpose({
  areaValues,
  updateGeoJSONResults,
})
</script>

<template>
  <div class="map-wrapper">
    <div id="map" class="map-container"></div>
    <DataCabinet
      v-if="map"
      :map="map as Map"
      :areaValues="areaValues!"
      :dataCabinetRef="dataCabinetRef"
      ref="dataCabinetRef"
      @updateGeoJSONResults="updateGeoJSONResults"
    />
    <ProcessingResults
      v-if="map"
      :map="map as Map"
      :geoJSONResults="geoJSONResults"
      @clearResults="clearResults"
    />
    <v-snackbar-queue
      closable
      timer
      close-on-back
      close-text="✖"
      v-model="messages"
    ></v-snackbar-queue>
  </div>

  <!-- Properties Box -->
  <div
    v-if="showPropertiesBox && selectedFeature && propertiesBoxPosition"
    class="properties-box"
    :style="{
      left: propertiesBoxPosition.x + 'px',
      top: propertiesBoxPosition.y + 'px',
    }"
  >
    <!-- Arrow indicator pointing to the clicked feature -->
    <div
      v-if="
        originalClickPosition &&
        (propertiesBoxPosition.x !== originalClickPosition.x ||
          propertiesBoxPosition.y !== originalClickPosition.y)
      "
      class="properties-arrow"
      :style="{
        left: originalClickPosition.x - propertiesBoxPosition.x + 'px',
        top: originalClickPosition.y - propertiesBoxPosition.y + 'px',
      }"
    ></div>
    <div class="properties-header">
      <h4>Field Properties</h4>
      <button class="close-properties" @click="hidePropertiesBox">×</button>
    </div>
    <div class="properties-content">
      <PropertyDisplay
        v-for="property in selectedFeature.cleanProperties"
        :key="property.key"
        :property="property"
      />
    </div>
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

/* Properties Box Styles */
.properties-box {
  position: fixed;
  background-color: rgba(0, 0, 0, 0.95);
  border: 2px solid rgba(0, 136, 136, 0.8);
  border-radius: 8px;
  padding: 0;
  min-width: 250px;
  max-width: 350px;
  z-index: 10000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
}

.properties-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(0, 136, 136, 0.3);
  background-color: rgba(0, 136, 136, 0.1);
}

.properties-header h4 {
  margin: 0;
  color: rgba(0, 136, 136, 1);
  font-size: 1rem;
  font-weight: 600;
}

.close-properties {
  background: none;
  border: none;
  color: rgba(0, 136, 136, 0.8);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-properties:hover {
  color: rgba(0, 136, 136, 1);
  background-color: rgba(0, 136, 136, 0.2);
}

.properties-content {
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

:deep(.ol-zoom) {
  top: unset;
  left: unset;
  bottom: 1rem;
  right: 1rem;
}

:deep(.ol-attribution) {
  top: unset;
  left: unset;
  bottom: 1rem;
  right: calc(2rem + 20px);
}

:deep(.ol-zoom button),
:deep(.ol-attribution button) {
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
}

:deep(.ol-zoom button:hover),
:deep(.ol-attribution button:hover) {
  background-color: rgba(0, 0, 0, 1);
  color: #fff;
}

:deep(.ol-attribution ul) {
  color: #000;
  font-size: 0.875rem;
  text-shadow: none;
}

:deep(.ol-attribution ul li a) {
  color: #000;
  text-decoration: underline;
}
</style>
