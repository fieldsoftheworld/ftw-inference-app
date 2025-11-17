<template>
  <v-card elevation="8" :class="{ closed: !isOpen, 'processing-results': true, sidebar: true }">
    <v-card-title class="d-flex align-center justify-space-between pa-2">
      <div class="collapse-action" @click="toggleCollapsible">
        <v-icon
          :class="{ 'rotate-180': isOpen }"
          class="mr-1 text-white transition-transform"
          :icon="mdiChevronDown"
        >
        </v-icon>
        <span class="text-white title">Results ({{ geoJsonResults.length }})</span>
      </div>
      <div class="d-flex align-right gap-2 ms-4">
        <v-btn
          @click="downloadResults"
          variant="plain"
          color="teal"
          class="pa-0 action-btn"
          title="Download Results"
          :icon="mdiDownloadBoxOutline"
        ></v-btn>
        <v-btn
          @click="clearResults"
          variant="plain"
          color="error"
          class="pa-0 action-btn"
          title="Clear Results"
          :icon="mdiDelete"
        ></v-btn>
      </div>
    </v-card-title>

    <div v-show="isOpen" class="content">
      <v-list density="compact" color="transparent" class="pa-0">
        <v-list-item
          v-for="result in geoJsonResults"
          :key="result.id"
          class="result-item"
          @click.stop="fitMapToResult(result)"
        >
          <div class="result-properties">
            <PropertiesDisplay :properties="result.properties" />
          </div>
        </v-list-item>
      </v-list>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import type Map from 'ol/Map'
import { ref, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import useMap from '../composables/useMap'
import useNotifier from '../composables/useNotifier'
import useAreaOfInterest from '../composables/useAreaOfInterest'
import PropertiesDisplay from './PropertiesDisplay.vue'
import { mdiDownloadBoxOutline, mdiDelete, mdiChevronDown } from '@mdi/js'
import { Feature } from 'geojson'

const props = defineProps<{
  map: Map
  geoJsonResults: any[]
}>()

const emit = defineEmits<{
  (e: 'clearResults'): void
}>()

const { map, handleMapClick, vectorLayer, selectedFeature, hidePropertiesBox } = useMap()
const { clearResultsAndZoomToGrid } = useAreaOfInterest()
const { showInfo, showError } = useNotifier()

const isOpen = ref(true)

const toggleCollapsible = () => {
  isOpen.value = !isOpen.value
}

const downloadResults = () => {
  if (!props.geoJsonResults || props.geoJsonResults.length === 0) {
    showInfo('No results to download.')
    return
  }

  try {
    // Create a GeoJSON FeatureCollection from the results
    const geojson = {
      type: 'FeatureCollection',
      features: props.geoJsonResults,
    }

    // Convert to JSON string
    const jsonString = JSON.stringify(geojson)

    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)

    // Create download link
    const link = document.createElement('a')
    link.href = url
    link.download = `processing-results-${new Date().toISOString().split('T')[0]}.geojson`

    // Trigger download
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading results:', error)
    showError('Failed to download results.')
  }
}

const fitMapToResult = (result: Feature) => {
  if (!result || !result.id) {
    showError('No valid geometry found for this result.')
    return
  }

  const resultFeature = vectorLayer.value?.getSource()?.getFeatureById(result.id)
  if (!resultFeature) {
    showError('Feature not found on the map.')
    return
  }

  hidePropertiesBox()

  // Highlight the result feature
  selectedFeature.value = resultFeature

  // Get the extent of the feature
  const extent = resultFeature.getGeometry()?.getExtent()

  if (
    !extent ||
    extent.every((coord: number) => coord === 0) ||
    extent.some((coord: number) => isNaN(coord))
  ) {
    showError('Invalid extent for this result.')
    return
  }

  // Calculate dynamic padding based on screen dimensions
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight
  // Use a percentage of screen dimensions for padding
  // This ensures the geometry fits regardless of screen size
  const paddingY = Math.max(100, screenHeight * 0.2) // At least 100px or 30% of screen height
  // Fit the map to the result's extent with dynamic padding
  props.map.getView().fit(extent, {
    duration: 1000,
    padding: [paddingY, screenWidth * 0.25, paddingY, screenWidth * 0.35], // [top, right, bottom, left]
    maxZoom: 17,
  })
}

onMounted(() => {
  // Add map click handler to detect feature clicks and show properties
  if (map.value) {
    map.value.on('click', handleMapClick)
  }
})

onBeforeUnmount(() => {
  selectedFeature.value = null
})

// Clean up map click handler when component is unmounted
onUnmounted(() => {
  if (map.value) {
    map.value.un('click', handleMapClick)
  }
})

const clearResults = () => {
  // Clear results and zoom back to S2 grid
  clearResultsAndZoomToGrid(props.map)
  // Emit event to clear results in parent components
  emit('clearResults')
}
</script>

<style scoped>
.processing-results {
  right: 1em;
  max-height: calc(100vh - 3rem - 40px);
  min-width: 250px;
  width: 260px;
  max-width: 45vw;
  height: 45vh;
}

.processing-results.sidebar .content {
  padding: 1px;
  overflow-y: auto;
}

.processing-results .v-list {
  background-color: transparent !important;
}

.result-item {
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 2px;
  margin-bottom: 2px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(0, 136, 136, 0.6);
}

.result-item:last-child {
  border-bottom: none !important;
}

.result-properties {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.v-list-item--density-compact.v-list-item--one-line {
  min-height: auto !important;
}
</style>
