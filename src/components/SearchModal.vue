<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Map } from 'ol'
import { mdiMagnify, mdiClose } from '@mdi/js'

interface Props {
  isOpen: boolean
  map: Map
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

const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)
const selectedTile = ref<any>(null)

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

// Close modal
const closeModal = () => {
  emit('update:isOpen', false)
  searchQuery.value = ''
  searchResults.value = []
  selectedTile.value = null
}

// Search for S2 tiles
const searchTiles = () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  isSearching.value = true

  // Get the S2 Grid layer from the map
  const layers = props.map.getLayers().getArray()
  const s2GridLayer = layers.find(
    (layer) =>
      layer.get('name') === 's2-grid' ||
      (layer.get('properties') && layer.get('properties').name === 's2-grid') ||
      ((layer as any).getSource && (layer as any).getSource().getFeatures),
  )

  if (s2GridLayer && (s2GridLayer as any).getSource) {
    const features = (s2GridLayer as any).getSource().getFeatures()
    const query = searchQuery.value.toLowerCase().trim()

    // Search in the Name property of features
    const results = features
      .filter((feature: any) => {
        const name = feature.get('Name')
        return name && name.toLowerCase().includes(query)
      })
      .slice(0, 10) // Limit to 10 results

    searchResults.value = results
  }
}

// Navigate to selected tile
const navigateToTile = (tile: any) => {
  if (!tile) return

  const geometry = tile.getGeometry()
  if (geometry) {
    const extent = geometry.getExtent()

    // Fit the map view to the tile extent with padding
    props.map.getView().fit(extent, {
      duration: 1000,
      maxZoom: 13,
      padding: [50, 50, 50, 50],
    })

    // Emit the tile selection event so the parent can handle it
    const tileName = tile.get('Name')
    if (tileName) {
      emit('tileSelected', tileName)
    }

    // Close the modal
    closeModal()
  }
}

// Handle search input
const handleSearchInput = () => {
  if (searchQuery.value.trim()) {
    searchTiles()
  } else {
    searchResults.value = []
  }
}

// Handle unified search
const handleUnifiedSearch = () => {
  const hasTileSearch = searchQuery.value.trim()
  const hasBboxInput =
    bboxInputs.value.minLon &&
    bboxInputs.value.minLat &&
    bboxInputs.value.maxLon &&
    bboxInputs.value.maxLat

  if (!hasTileSearch && !hasBboxInput) {
    alert('Please enter either a tile name or bbox coordinates')
    return
  }

  // If we have a tile search query, set the currentMgrsTileId
  if (hasTileSearch) {
    emit('setCurrentMgrsTileId', searchQuery.value.trim())
  }

  // Set activeTileId and secondActiveTileId based on window values
  if (windowA.value.trim()) {
    emit('setActiveTileId', windowA.value.trim())
  }
  if (windowB.value.trim()) {
    emit('setSecondActiveTileId', windowB.value.trim())
  }

  // If we have bbox coordinates, validate them
  if (hasBboxInput) {
    const { minLon, minLat, maxLon, maxLat } = bboxInputs.value
    const bbox = [parseFloat(minLon), parseFloat(minLat), parseFloat(maxLon), parseFloat(maxLat)]

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

    // Emit the bbox selection event
    emit('bboxSelected', bbox)

    // Fit the map view to the bbox extent
    const extent = bbox
    props.map.getView().fit(extent, {
      duration: 1000,
      maxZoom: 13,
      padding: [50, 50, 50, 50],
    })
  }

  // If we have tile search, perform it
  if (hasTileSearch) {
    searchTiles()
  } else {
    // If only bbox, close modal after navigation
    closeModal()
  }
}

// Computed properties
const hasResults = computed(() => searchResults.value.length > 0)

const hasAnyInput = computed(() => {
  return (
    searchQuery.value.trim() ||
    (bboxInputs.value.minLon &&
      bboxInputs.value.minLat &&
      bboxInputs.value.maxLon &&
      bboxInputs.value.maxLat)
  )
})
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Enter Search Parameters</h3>
        <button class="close-button" @click="closeModal">
          <v-icon :icon="mdiClose" size="small" />
        </button>
      </div>

      <div class="modal-body">
        <div class="search-container">
          <div class="search-input-wrapper">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Enter S2 tile name (e.g., 12SXA, 13TDE)"
              class="search-input"
              @input="handleSearchInput"
              @keyup.enter="searchTiles"
            />

            <!-- Dropdown for matching tiles -->
            <div v-if="searchQuery.trim() && hasResults" class="tile-dropdown">
              <div
                v-for="tile in searchResults"
                :key="tile.get('Name')"
                class="dropdown-item"
                @click="navigateToTile(tile)"
              >
                {{ tile.get('Name') }}
              </div>
            </div>
            <!-- Bbox Input Section -->
            <div class="bbox-section">
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
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Window A and B Inputs -->
            <div class="window-section">
              <h4>Window A|B:</h4>
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
          :disabled="!hasAnyInput"
          class="search-button"
        >
          Search
        </v-btn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-input-wrapper {
  position: relative; /* Required for dropdown positioning */
}

.tile-dropdown {
  position: absolute;
  top: 50px; /* Position below the input */
  left: 0;
  width: 100%;
  background-color: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
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
