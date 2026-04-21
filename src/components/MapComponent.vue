<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Map, View } from 'ol'
import { ScaleLine } from 'ol/control'
import DataCabinet from './DataCabinet.vue'
import GlobalFeedbackWidget from './GlobalFeedbackWidget.vue'
import ProcessingResults from './ProcessingResults.vue'
import PropertiesDisplay from './PropertiesDisplay.vue'
import DownloadModal from './DownloadModal.vue'
import createLabelLayer from '../layers/Label-Layer'
import { generateJWT } from '../functions/generate-jwt'
import useAreaOfInterest from '../composables/useAreaOfInterest'
import usePermalink from '../composables/usePermalink'
import useMap from '../composables/useMap'
import useSettings from '../composables/useSettings'
import useDownloadGrid from '../composables/useDownloadGrid'
import { createXYZ } from 'ol/tilegrid'

const {
  map,
  areaValues,
  showPropertiesBox,
  selectedFeature,
  propertiesBoxPosition,
  originalClickPosition,
  hidePropertiesBox,
  handleMapClick,
  geoJsonResults,
  initCloudlessLayer,
  updateLayers,
} = useMap()

const { showDownloadModal, selectedGridCell, closeDownloadModal } = useDownloadGrid()

const { addMapClickHandler } = useAreaOfInterest()
const { setAvailableModels, settings } = useSettings()

const clearResults = () => {
  geoJsonResults.value = []
  hidePropertiesBox()
}

const { setupPermalink } = usePermalink()

const critical = ref<string | null>(null)

onMounted(async () => {
  map.value = new Map({
    target: 'map',
    layers: [createLabelLayer()],
    view: new View({
      maxResolution: createXYZ({ tileSize: 512 }).getResolution(0), // use Mapbox/MapLibre compatible resolutions
      center: [0, 0],
      zoom: 1,
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
      throw new Error(error)
    }
    if (typeof data.min_area_km2 === 'number') {
      areaValues.value.min_area_km2 = data.min_area_km2
      areaValues.value.default = false
    }
    if (typeof data.max_area_km2 === 'number') {
      areaValues.value.max_area_km2 = data.max_area_km2
      areaValues.value.default = false
    }

    // Set available models if they exist in the response
    if (data.models && Array.isArray(data.models)) {
      setAvailableModels(data.models)
    }
  } catch (error: any) {
    critical.value = `Can't connect to server: ${error?.message || error}`
  }

  // Add layers after map is initialized
  if (map.value) {
    // Initialize the cloudless base layer
    initCloudlessLayer()

    // Initialize layers
    updateLayers()

    addMapClickHandler(map.value as Map, areaValues.value)
    map.value.on('click', handleMapClick)
    // Add scale bar
    map.value.addControl(new ScaleLine())
    // Setup permalink functionality
    setupPermalink(map)
  }
})

// Expose methods to parent components
defineExpose({
  areaValues,
})
</script>

<template>
  <div class="map-wrapper">
    <div id="map" class="map-container"></div>

    <DataCabinet v-if="map" :map="map as Map" :areaValues="areaValues" />

    <ProcessingResults
      v-if="geoJsonResults.length > 0"
      :map="map as Map"
      :geoJsonResults="geoJsonResults"
      @clearResults="clearResults"
    />

    <GlobalFeedbackWidget v-if="map && settings.mode === 'global'" />
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
    <div class="d-flex align-center justify-space-between ps-4 pe-4 pt-2 pb-2 properties-header">
      <h4>Field Properties</h4>
      <div class="d-flex align-right gap-2 ms-4">
        <v-btn
          @click="hidePropertiesBox"
          variant="plain"
          color="teal"
          class="pa-0 action-btn"
          text="✖"
        ></v-btn>
      </div>
    </div>
    <div class="properties-content">
      <PropertiesDisplay :properties="selectedFeature.getProperties()" />
    </div>
  </div>

  <DownloadModal
    v-model="showDownloadModal"
    :cell="selectedGridCell"
    @update:model-value="!$event && closeDownloadModal()"
  />

  <header v-if="critical" id="critical">
    <v-alert closable type="error" :text="critical"></v-alert>
  </header>
</template>

<style scoped>
#critical {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

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

.properties-box .action-btn {
  min-width: auto;
}

.properties-header {
  border-bottom: 1px solid rgba(0, 136, 136, 0.3);
  background-color: rgba(0, 136, 136, 0.1);
}

.properties-header h4 {
  margin: 0;
  color: rgba(0, 136, 136, 1);
  font-size: 1rem;
  font-weight: 600;
}

.properties-content {
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

:deep(.ol-zoom),
:deep(.ol-attribution),
:deep(.ol-scale-line) {
  --ol-background-color: black;
  --ol-accent-background-color: #333333;
  --ol-subtle-background-color: rgba(128, 128, 128, 0.25);
  --ol-partial-background-color: rgba(0, 0, 0, 0.75);
  --ol-foreground-color: #eeeeee;
  --ol-subtle-foreground-color: #aaaaaa;
}

:deep(.ol-zoom) {
  top: unset;
  right: unset;
  bottom: 1rem;
  left: 1rem;
  z-index: 10000;
}

:deep(.ol-scale-line) {
  top: unset;
  right: unset;
  bottom: 1rem;
  left: 3rem;
  z-index: 2000;
}

:deep(.ol-attribution) {
  top: unset;
  right: unset;
  bottom: calc(4rem);
  left: 1rem;
  z-index: 10000;
  flex-direction: row;
  max-width: 30vw;
  align-items: end;
  text-align: left;
}

:deep(.ol-attribution button) {
  order: -1;
}

:deep(.ol-attribution ul) {
  font-size: 0.875rem;
}
</style>
