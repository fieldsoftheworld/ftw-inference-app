<template>
  <div v-if="geoJSONResults.length > 0" class="processing-results">
    <div class="accordion-header">
      <div class="header-content" @click="toggleResultsList">
        <h3>Results ({{ geoJSONResults.length }})</h3>
        <span class="accordion-icon" :class="{ open: isResultsListOpen }">▼</span>
      </div>
      <button class="clear-results-button" @click="clearResults" title="Clear Results">🗑️</button>
    </div>

    <transition name="accordion">
      <div v-show="isResultsListOpen" class="results-list">
        <div
          v-for="result in processedResults"
          :key="result.id"
          class="result-item"
          @click="fitMapToResult(result)"
        >
          <div class="result-header">
            <h4>{{ result.properties.id }}</h4>
            <button class="fit-map-button" @click.stop="fitMapToResult(result)">
              <span>📍</span>
            </button>
          </div>
          <div class="result-properties">
            <div v-for="[key, value] in result.filteredProperties" :key="key" class="property-item">
              <span class="property-key">{{ key }}:</span>
              <span class="property-value">{{
                typeof value === 'number' ? value.toFixed(2) : value
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import type Map from 'ol/Map'
import { ref, watch } from 'vue'
import { showWarning } from '../functions/snackbar'
import { useAreaOfInterest } from '../composables/useAreaOfInterest'

const props = defineProps<{
  map: Map
  geoJSONResults: any[]
}>()

const emit = defineEmits<{
  (e: 'clearResults'): void
}>()

const { setBlockMapClicks, clearResultsAndZoomToGrid } = useAreaOfInterest()

import { computed } from 'vue'

const processedResults = computed(() => {
  return [...props.geoJSONResults]
    .sort((a, b) => {
      const idA = a.properties?.id || a.id || ''
      const idB = b.properties?.id || b.id || ''
      // Convert to numbers for proper numerical sorting
      const numA = parseInt(idA) || 0
      const numB = parseInt(idB) || 0
      return numA - numB
    })
    .map((result) => ({
      ...result,
      filteredProperties: Object.entries(result.properties || {}).filter(
        ([key]) => key !== 'geometry',
      ),
    }))
})

const isResultsListOpen = ref(false)

const toggleResultsList = () => {
  isResultsListOpen.value = !isResultsListOpen.value
}

const fitMapToResult = (result: any) => {
  if (!result || !result.geometry) {
    showWarning('No valid geometry found for this result.')
    return
  }

  try {
    // Get the extent of the feature
    const extent = result.geometry.getExtent()
    if (
      !extent ||
      extent.every((coord: number) => coord === 0) ||
      extent.some((coord: number) => isNaN(coord))
    ) {
      showWarning('Invalid extent for this result.')
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
      padding: [paddingY, paddingX + 325, paddingY, paddingX + 175], // [top, right, bottom, left]
    })
  } catch (error) {
    console.error('Error fitting map to result:', error)
    showWarning('Error fitting map to result.')
  }
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
  { immediate: true },
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
  top: 20px;
  left: 20px;
  width: 175px;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.9);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: rgba(0, 136, 136, 0.2);
  border: 1px solid rgba(0, 136, 136, 0.8);
  border-radius: 8px 8px 0 0;
  transition: background-color 0.2s ease;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  cursor: pointer;
}

.clear-results-button {
  background: none;
  border: 1px solid rgba(255, 0, 0, 0.6);
  border-radius: 4px;
  color: rgba(255, 0, 0, 0.8);
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.clear-results-button:hover {
  background-color: rgba(255, 0, 0, 0.2);
  border-color: rgba(255, 0, 0, 1);
  color: rgba(255, 0, 0, 1);
}

.header-content:hover {
  background-color: rgba(0, 136, 136, 0.3);
}

.accordion-header h3 {
  margin: 0;
  font-size: 1rem;
  color: white;
  font-weight: 600;
}

.accordion-icon {
  color: white;
  transition: transform 0.3s ease;
  font-size: 0.75rem;
}

.accordion-icon.open {
  transform: rotate(180deg);
}

.results-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid rgba(0, 136, 136, 0.3);
  border-top: none;
  border-radius: 0 0 8px 8px;
  background-color: rgba(0, 0, 0, 0.95);
}

.results-list .result-item {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(0, 136, 136, 0.2);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.results-list .result-item:hover {
  background-color: rgba(0, 136, 136, 0.1);
}

.results-list .result-item:last-child {
  border-bottom: none;
}

.results-list .result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.results-list .result-header h4 {
  margin: 0;
  font-size: 0.875rem;
  color: white;
  font-weight: 600;
}

.fit-map-button {
  background: none;
  border: 1px solid rgba(0, 136, 136, 0.6);
  border-radius: 4px;
  color: rgba(0, 136, 136, 0.8);
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
}

.fit-map-button:hover {
  background-color: rgba(0, 136, 136, 0.2);
  border-color: rgba(0, 136, 136, 1);
  color: rgba(0, 136, 136, 1);
}

.result-properties {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.result-properties .property-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  padding: 0.25rem 0;
}

.result-properties .property-key {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  text-transform: capitalize;
}

.result-properties .property-value {
  color: white;
  text-align: right;
  max-width: 120px;
  word-break: break-word;
}

/* Accordion transition */
.accordion-enter-active,
.accordion-leave-active {
  transition: all 0.3s ease;
}

.accordion-enter-from,
.accordion-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}
</style>
