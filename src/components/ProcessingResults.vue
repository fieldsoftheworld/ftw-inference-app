<template>
  <v-card
    v-if="geoJSONResults.length > 0"
    elevation="8"
    color="rgba(0, 0, 0, 0.9)"
    rounded="lg"
    :class="{ closed: !isResultsListOpen, 'processing-results': true }"
  >
    <v-card-title
      class="d-flex align-center justify-space-between pa-2"
      style="background-color: rgba(0, 136, 136, 0.2); border: 1px solid rgba(0, 136, 136, 0.8)"
    >
      <div class="d-flex align-center" @click="toggleResultsList" style="cursor: pointer; flex: 1">
        <span class="text-h6 text-white font-weight-bold"
          >Results ({{ geoJSONResults.length }})</span
        >
        <v-icon
          :class="{ 'rotate-180': isResultsListOpen }"
          class="ml-2 text-white transition-transform"
          size="large"
          :icon="mdiChevronDown"
        >
        </v-icon>
      </div>
      <div class="d-flex align-center">
        <v-btn
          @click="downloadResults"
          size="small"
          variant="plain"
          color="teal"
          class="mr-0 pa-0 ml-4 action-btn"
          title="Download Results"
        >
          <v-icon :icon="mdiDownloadBoxOutline" size="x-large"></v-icon>
        </v-btn>
        <v-btn
          @click="clearResults"
          size="small"
          variant="plain"
          color="error"
          class="ml-0 mr-2 pa-0 action-btn"
          title="Clear Results"
        >
          <v-icon :icon="mdiDelete" size="x-large"></v-icon>
        </v-btn>
      </div>
    </v-card-title>

    <div v-show="isResultsListOpen" class="results-list">
      <v-list
        density="compact"
        color="transparent"
        class="pa-0"
        style="background-color: rgba(0, 0, 0, 0.95)"
      >
        <v-list-item
          v-for="result in processedResults"
          :key="result.id"
          class="result-item"
          @click.stop="fitMapToResult(result)"
        >
          <v-list-item-subtitle class="mt-2">
            <div class="result-properties">
              <PropertyDisplay
                v-for="property in result.filteredProperties"
                :key="property.key"
                :property="property"
              />
            </div>
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import type Map from 'ol/Map'
import { ref, watch } from 'vue'
import { useSnackbar } from '../composables/useSnackbar'
import { useAreaOfInterest } from '../composables/useAreaOfInterest'
import PropertyDisplay from './PropertyDisplay.vue'
import { mdiDownloadBoxOutline, mdiDelete, mdiChevronDown } from '@mdi/js'

const props = defineProps<{
  map: Map
  geoJSONResults: any[]
}>()

const emit = defineEmits<{
  (e: 'clearResults'): void
}>()

const { setBlockMapClicks, clearResultsAndZoomToGrid } = useAreaOfInterest()
const { showInfo, showError } = useSnackbar()

import { computed } from 'vue'
import { formatMeasurementDisplay } from '../functions/format-measurement-display'

const processedResults = computed(() => {
  const formattedResults = new Array(props.geoJSONResults.length)
  for (const {
    properties: { geometry, id, ...rest },
    id: featureId,
    ...feature
  } of props.geoJSONResults) {
    formattedResults[parseInt(id) - 1] = {
      id,
      ...feature,
      filteredProperties: Object.entries({ id, ...rest }).reduce((acc, [key, value]) => {
        acc.push({
          key,
          value,
          formattedValue: formatMeasurementDisplay(value as number, key),
        })
        return acc
      }, [] as { key: string; value: any; formattedValue: string }[]),
    }
  }
  return formattedResults
})

const isResultsListOpen = ref(false)

const toggleResultsList = () => {
  isResultsListOpen.value = !isResultsListOpen.value
}

const downloadResults = () => {
  if (!props.geoJSONResults || props.geoJSONResults.length === 0) {
    showInfo('No results to download.')
    return
  }

  try {
    // Create a GeoJSON FeatureCollection from the results
    const geojson = {
      type: 'FeatureCollection',
      features: props.geoJSONResults,
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

const fitMapToResult = (result: any) => {
  if (!result || !result.geometry) {
    showError('No valid geometry found for this result.')
    return
  }

  // Get the extent of the feature
  const extent = result.geometry.getExtent()
  if (
    !extent ||
    extent.every((coord: number) => coord === 0) ||
    extent.some((coord: number) => isNaN(coord))
  ) {
    showError('Invalid extent for this result.')
    return
  }

  // The extent is already in CRS84 (EPSG:4326), so no transformation needed
  const transformedExtent = extent

  // Calculate dynamic padding based on screen dimensions
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight
  // Use a percentage of screen dimensions for padding
  // This ensures the geometry fits regardless of screen size
  const paddingX = Math.max(100, screenWidth * 0.1) // At least 100px or 15% of screen width
  const paddingY = Math.max(100, screenHeight * 0.1) // At least 100px or 10% of screen height

  // Fit the map to the result's extent with dynamic padding
  props.map.getView().fit(transformedExtent, {
    duration: 1000,
    padding: [paddingY, paddingX + 500, paddingY, paddingX + 200], // [top, right, bottom, left]
  })
}

// Watch for changes in geoJSONResults to auto-open the list when new results arrive
watch(
  () => props.geoJSONResults,
  (newResults) => {
    if (newResults.length > 0 && !isResultsListOpen.value) {
      isResultsListOpen.value = true
      // Block map clicks when results are displayed
      setBlockMapClicks(true)
    } else if (newResults.length === 0) {
      // Unblock map clicks when results are cleared
      setBlockMapClicks(false)
      isResultsListOpen.value = false
    }
  },
  { immediate: true }
)

const clearResults = () => {
  // Clear results and zoom back to S2 grid
  clearResultsAndZoomToGrid(props.map)
  // Emit event to clear results in parent components
  emit('clearResults')
}
</script>

<style scoped>
.processing-results {
  position: fixed;
  top: 2.5vh;
  left: 2vw;
  z-index: 1000;
  min-width: 250px;
  width: 260px;
  max-width: 50vw;
  min-height: 50px;
  height: 400px;
  max-height: 95vh;
  resize: both;
  display: flex;
  flex-direction: column;
}

.processing-results.closed {
  height: auto !important;
  min-height: none;
  resize: none;
}

.results-list {
  overflow-y: auto;
  height: 100%;
  flex-grow: 1;
  padding: 1px;
}

.result-item {
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  margin-bottom: 0.5rem;
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

.rotate-180 {
  transform: rotate(180deg);
}

.transition-transform {
  transition: transform 0.3s ease;
}

.action-btn {
  width: 30px !important;
  min-width: 30px !important;
  max-width: 30px !important;
  height: 30px !important;
}
</style>
