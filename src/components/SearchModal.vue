<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Map } from 'ol'
import { mdiMagnify, mdiClose } from '@mdi/js'
import { useAreaOfInterest } from '../composables/useAreaOfInterest'
import { fromExtent } from 'ol/geom/Polygon'

interface Props {
  isOpen: boolean
  map: Map
  areaValues: { min_area_km2: number; max_area_km2: number }
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void
  (e: 'tileSelected', tileName: string): void
  (e: 'bboxSelected', bbox: number[]): void
  (e: 'setCurrentMgrsTileId', tileId: string): void
  (e: 'setActiveTileId', tileId: string): void
  (e: 'setSecondActiveTileId', tileId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Use the area calculation function from the composable
const { calculateArea } = useAreaOfInterest()

const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)
const selectedTile = ref<any>(null)
const availableTiles = ref<any[]>([])
const showTileDropdown = ref(false)

// Bbox input fields
const bboxInputs = ref({
  minLon: '',
  minLat: '',
  maxLon: '',
  maxLat: '',
})

// Window A and B input fields
const windowA = ref('')
const windowB = ref('')

// Error message for area validation
const areaErrorMessage = ref('')

const shouldShowDropdown = computed(() => {
  return (
    showTileDropdown.value &&
    ((searchQuery.value.trim() && filteredTiles.value.length > 0) ||
      (!searchQuery.value.trim() && availableTiles.value.length > 0))
  )
})

// Function to calculate bbox area in square kilometers using the composable
const calculateBboxArea = (bbox: number[]): number => {
  // Create a polygon from the bbox
  const polygon = fromExtent(bbox)

  // Use the composable's calculateArea function
  return calculateArea(polygon, false)
}

// Function to validate bbox area
const validateBboxArea = (bbox: number[]): { isValid: boolean; message: string } => {
  const area = calculateBboxArea(bbox)

  if (area < props.areaValues.min_area_km2) {
    return {
      isValid: false,
      message: `Bounding box area (${area.toFixed(2)} km²) is too small. Minimum area required: ${props.areaValues.min_area_km2} km²`,
    }
  }

  if (area > props.areaValues.max_area_km2) {
    return {
      isValid: false,
      message: `Bounding box area (${area.toFixed(2)} km²) is too large. Maximum area allowed: ${props.areaValues.max_area_km2} km²`,
    }
  }

  return { isValid: true, message: '' }
}

// Close modal
const closeModal = () => {
  emit('update:isOpen', false)
  searchQuery.value = ''
  searchResults.value = []
  selectedTile.value = null
  showTileDropdown.value = false
  areaErrorMessage.value = ''
}

// Load available S2 tiles from the map layer
const loadAvailableTiles = () => {
  if (!props.map) {
    return
  }

  const layers = props.map.getLayers().getArray()

  const s2GridLayer = layers.find(
    (layer) =>
      layer.get('name') === 's2-grid' ||
      (layer.get('properties') && layer.get('properties').name === 's2-grid') ||
      ((layer as any).getSource && (layer as any).getSource().getFeatures),
  )

  if (s2GridLayer && (s2GridLayer as any).getSource) {
    const features = (s2GridLayer as any).getSource().getFeatures()

    availableTiles.value = features
      .map((feature: any) => ({
        feature,
        name: feature.get('Name'),
        geometry: feature.getGeometry(),
      }))
      .filter((tile: any) => tile.name) // Only include tiles with names
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) // Sort alphabetically
  }
}

// Filter tiles based on search query
const filteredTiles = computed(() => {
  if (!searchQuery.value.trim()) {
    return availableTiles.value.sort((a: any, b: any) => a.name.localeCompare(b.name)).slice(0, 20) // Show first 20 tiles by default
  }

  const query = searchQuery.value.toLowerCase().trim()
  return availableTiles.value
    .filter((tile: any) => tile.name.toLowerCase().includes(query))
    .slice(0, 20) // Limit to 20 results
})

// Select a tile from the dropdown
const selectTile = (tile: any) => {
  selectedTile.value = tile
  searchQuery.value = tile.name
  showTileDropdown.value = false
}

// Navigate to selected tile and perform search
const navigateToTileAndSearch = () => {
  if (!selectedTile.value) {
    alert('Please select an S2 grid tile first')
    return
  }

  const geometry = selectedTile.value.geometry
  if (geometry) {
    const extent = geometry.getExtent()

    // Fit the map view to the tile extent with padding
    props.map.getView().fit(extent, {
      duration: 1000,
      maxZoom: 13,
      padding: [50, 50, 50, 50],
    })

    // Emit the tile selection event so the parent can handle it
    const tileName = selectedTile.value.name
    if (tileName) {
      emit('tileSelected', tileName)
      emit('setCurrentMgrsTileId', tileName)
    }

    // Set activeTileId and secondActiveTileId based on window values
    if (windowA.value.trim()) {
      emit('setActiveTileId', windowA.value.trim())
    }
    if (windowB.value.trim()) {
      emit('setSecondActiveTileId', windowB.value.trim())
    }

    // If we have bbox coordinates, validate and emit them
    const hasBboxInput =
      bboxInputs.value.minLon &&
      bboxInputs.value.minLat &&
      bboxInputs.value.maxLon &&
      bboxInputs.value.maxLat

    if (hasBboxInput) {
      const { minLon, minLat, maxLon, maxLat } = bboxInputs.value
      const bbox = [parseFloat(minLon), parseFloat(minLat), parseFloat(maxLon), parseFloat(maxLat)]

      // Clear any previous area error message
      areaErrorMessage.value = ''

      // Validate coordinate ranges
      if (bbox[0] < -180 || bbox[0] > 180 || bbox[2] < -180 || bbox[2] > 180) {
        alert('Longitude must be between -180 and 180')
        return
      }
      if (bbox[1] < -90 || bbox[1] > 90 || bbox[3] < -90 || bbox[3] > 90) {
        alert('Latitude must be between -90 and 90')
        return
      }
      if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) {
        alert('Invalid bbox: min coordinates must be less than max coordinates')
        return
      }

      // Validate bbox area
      const areaValidation = validateBboxArea(bbox)
      if (!areaValidation.isValid) {
        areaErrorMessage.value = areaValidation.message
        return
      }

      // Emit the bbox selection event
      emit('bboxSelected', bbox)
    }

    // Close the modal after navigation
    closeModal()
  }
}

// Handle search input for filtering tiles
const handleSearchInput = () => {
  // Always show dropdown when typing
  showTileDropdown.value = true
}

// Handle bbox input changes to clear error messages
const handleBboxInputChange = () => {
  areaErrorMessage.value = ''
}

// Handle unified search (now just validates and calls navigateToTileAndSearch)
const handleUnifiedSearch = () => {
  if (!selectedTile.value) {
    alert('Please select an S2 grid tile first')
    return
  }

  navigateToTileAndSearch()
}

// Close dropdown when clicking outside
const closeDropdown = () => {
  showTileDropdown.value = false
}

// Handle click outside dropdown
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.tile-input-wrapper')) {
    closeDropdown()
  }
}

onMounted(() => {
  // Add click outside listener
  document.addEventListener('click', handleClickOutside)
})

// Watch for map changes to reload tiles
watch(
  () => props.map,
  (newMap) => {
    if (newMap) {
      loadAvailableTiles()
      // If no tiles loaded, retry after a delay
      if (availableTiles.value.length === 0) {
        setTimeout(() => loadAvailableTiles(), 500)
      }
    }
  },
  { immediate: true },
)

// Clean up event listener
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Select S2 Grid and Search Parameters</h3>
        <button class="close-button" @click="closeModal">
          <v-icon :icon="mdiClose" size="small" />
        </button>
      </div>

      <div class="modal-body">
        <div class="search-container">
          <div class="search-input-wrapper">
            <!-- S2 Grid Selection Dropdown -->
            <div class="tile-selection-section">
              <h4>S2 Grid Selection:</h4>
              <div class="tile-input-wrapper">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search for S2 tile (e.g., 12SXA, 13TDE)"
                  class="search-input"
                  @input="handleSearchInput"
                  @focus="showTileDropdown = true"
                />

                <!-- Search icon -->
                <div class="search-icon">
                  <v-icon :icon="mdiMagnify" size="small" />
                </div>

                <!-- Dropdown for available tiles -->
                <div v-if="shouldShowDropdown" class="tile-dropdown">
                  <div
                    v-for="tile in filteredTiles"
                    :key="tile.name"
                    class="dropdown-item"
                    @click="selectTile(tile)"
                  >
                    {{ tile.name }}
                  </div>
                </div>

                <!-- No results message -->
                <div
                  v-if="showTileDropdown && searchQuery.trim() && filteredTiles.length === 0"
                  class="no-results"
                >
                  No tiles found matching "{{ searchQuery }}"
                </div>

                <!-- Show available tiles when no search query -->
                <div
                  v-if="showTileDropdown && !searchQuery.trim() && availableTiles.length > 0"
                  class="tile-dropdown"
                >
                  <div class="dropdown-header">Available S2 Tiles:</div>
                  <div
                    v-for="tile in availableTiles.slice(0, 20)"
                    :key="tile.name"
                    class="dropdown-item"
                    @click="selectTile(tile)"
                  >
                    {{ tile.name }}
                  </div>
                </div>

                <!-- Selected tile display -->
                <div v-if="selectedTile" class="selected-tile">
                  <strong>Selected:</strong> {{ selectedTile.name }}
                </div>
              </div>
            </div>

            <!-- Bbox Input Section -->
            <div class="bbox-section">
              <h4>Bounding Box (Optional):</h4>
              <div class="bbox-inputs">
                <div class="bbox-row">
                  <div class="bbox-input-group">
                    <label>Min Longitude</label>
                    <input
                      v-model="bboxInputs.minLon"
                      type="number"
                      step="any"
                      placeholder="-180.0"
                      class="bbox-input"
                      @input="handleBboxInputChange"
                    />
                  </div>
                  <div class="bbox-input-group">
                    <label>Min Latitude</label>
                    <input
                      v-model="bboxInputs.minLat"
                      type="number"
                      step="any"
                      placeholder="-90.0"
                      class="bbox-input"
                      @input="handleBboxInputChange"
                    />
                  </div>
                </div>
                <div class="bbox-row">
                  <div class="bbox-input-group">
                    <label>Max Longitude</label>
                    <input
                      v-model="bboxInputs.maxLon"
                      type="number"
                      step="any"
                      placeholder="180.0"
                      class="bbox-input"
                      @input="handleBboxInputChange"
                    />
                  </div>
                  <div class="bbox-input-group">
                    <label>Max Latitude</label>
                    <input
                      v-model="bboxInputs.maxLat"
                      type="number"
                      step="any"
                      placeholder="90.0"
                      class="bbox-input"
                      @input="handleBboxInputChange"
                    />
                  </div>
                </div>
              </div>

              <!-- Area validation error message -->
              <div v-if="areaErrorMessage" class="area-error-message">
                {{ areaErrorMessage }}
              </div>
            </div>

            <!-- Window A and B Inputs -->
            <div class="window-section">
              <h4>Window A|B (Optional):</h4>
              <div class="window-inputs">
                <div class="window-row">
                  <div class="window-input-group">
                    <label>Window A</label>
                    <input
                      v-model="windowA"
                      type="text"
                      placeholder="Enter Window A"
                      class="window-input"
                    />
                  </div>
                  <div class="window-input-group">
                    <label>Window B</label>
                    <input
                      v-model="windowB"
                      type="text"
                      placeholder="Enter Window B"
                      class="window-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <v-btn
          color="primary"
          @click="handleUnifiedSearch"
          :loading="isSearching"
          :disabled="!selectedTile"
          class="search-button"
        >
          Navigate to Tile & Search
        </v-btn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tile-selection-section {
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: rgba(0, 136, 136, 0.05);
  border: 1px solid rgba(0, 136, 136, 0.2);
  border-radius: 4px;
}

.tile-selection-section h4 {
  margin: 0 0 0.75rem 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
}

.tile-input-wrapper {
  position: relative;
  z-index: 1001; /* Ensure dropdown appears above other elements */
}

.selected-tile {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: rgba(0, 136, 136, 0.2);
  border: 1px solid rgba(0, 136, 136, 0.4);
  border-radius: 4px;
  color: rgba(0, 136, 136, 1);
  font-size: 0.875rem;
}

.search-input-wrapper {
  position: relative; /* Required for dropdown positioning */
}

.tile-dropdown {
  position: absolute;
  top: 100%; /* Position below the input */
  left: 0;
  width: 100%;
  background-color: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000; /* Higher z-index to ensure visibility */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  margin-top: 2px; /* Small gap from input */
}

.dropdown-item {
  padding: 0.75rem 0.75rem 0.75rem 2.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
  font-size: 0.875rem;
}

.dropdown-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(0, 136, 136, 0.6);
}

.dropdown-header {
  padding: 0.75rem 0.75rem 0.75rem 2.5rem;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 0.5rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background-color: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(0, 136, 136, 0.8);
  border-radius: 8px;
  width: 90%;
  max-width: 430px;
  max-height: 90vh;
  overflow-y: auto;
  color: white;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: white;
}

.close-button {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-button:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.1);
}

.modal-body {
  padding: 1rem;
}

.search-container {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.6);
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 0.75rem 0.75rem 0.75rem 2.5rem;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: rgba(0, 136, 136, 0.8);
  background-color: rgba(255, 255, 255, 0.15);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.search-button {
  white-space: nowrap;
}

.search-results {
  margin-top: 1rem;
}

.search-results h4 {
  margin: 0 0 0.75rem 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
}

.results-list {
  max-height: 300px;
  overflow-y: auto;
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

.tile-name {
  font-weight: 600;
  color: rgba(0, 136, 136, 1);
  margin-bottom: 0.25rem;
}

.tile-info {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
}

.tile-coords {
  font-family: monospace;
}

.no-results {
  text-align: center;
  padding: 1rem;
  color: rgba(255, 255, 255, 0.7);
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  margin-top: 2px;
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  z-index: 1000;
}

.help-text {
  margin-top: 1rem;
  padding: 1rem;
  background-color: rgba(0, 136, 136, 0.1);
  border: 1px solid rgba(0, 136, 136, 0.3);
  border-radius: 4px;
  color: rgba(0, 136, 136, 0.8);
  font-size: 0.875rem;
}

.help-text p {
  margin: 0.25rem 0;
}

.bbox-section {
  margin-top: 1rem;
  padding: 1rem;
  background-color: rgba(0, 136, 136, 0.05);
  border: 1px solid rgba(0, 136, 136, 0.2);
  border-radius: 4px;
}

.bbox-section h4 {
  margin: 0 0 0.75rem 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
}

.bbox-inputs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bbox-row {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.bbox-input-group {
  display: flex;
  flex-direction: column;
}

.bbox-input-group label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0.25rem;
}

.bbox-input {
  width: 100%;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.bbox-input:focus {
  outline: none;
  border-color: rgba(0, 136, 136, 0.8);
  background-color: rgba(255, 255, 255, 0.15);
}

.bbox-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.area-error-message {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background-color: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
  border-radius: 4px;
  color: #ff6b6b;
  font-size: 0.875rem;
  text-align: center;
}

.window-section {
  margin-top: 1rem;
  padding: 1rem;
  background-color: rgba(0, 136, 136, 0.05);
  border: 1px solid rgba(0, 136, 136, 0.2);
  border-radius: 4px;
}

.window-section h4 {
  margin: 0 0 0.75rem 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
}

.window-inputs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.window-row {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.window-input-group {
  display: flex;
  flex-direction: column;
}

.window-input-group label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0.25rem;
}

.window-input {
  width: 100%;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.window-input:focus {
  outline: none;
  border-color: rgba(0, 136, 136, 0.8);
  background-color: rgba(255, 255, 255, 0.15);
}

.window-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}
</style>
