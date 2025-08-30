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
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)
const selectedTile = ref<any>(null)

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

  try {
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
  } catch (error) {
    console.error('Error searching tiles:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

// Navigate to selected tile
const navigateToTile = (tile: any) => {
  if (!tile) return

  try {
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
  } catch (error) {
    console.error('Error navigating to tile:', error)
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

// Computed properties
const hasResults = computed(() => searchResults.value.length > 0)
const noResults = computed(
  () => searchQuery.value.trim() && !isSearching.value && searchResults.value.length === 0,
)
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Search S2 Tiles</h3>
        <button class="close-button" @click="closeModal">
          <v-icon :icon="mdiClose" size="small" />
        </button>
      </div>

      <div class="modal-body">
        <div class="search-container">
          <div class="search-input-wrapper">
            <v-icon :icon="mdiMagnify" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Enter S2 tile name (e.g., 12SXA, 13TDE)"
              class="search-input"
              @input="handleSearchInput"
              @keyup.enter="searchTiles"
            />
          </div>

          <v-btn
            color="primary"
            @click="searchTiles"
            :loading="isSearching"
            :disabled="!searchQuery.trim()"
            class="search-button"
          >
            Search
          </v-btn>
        </div>

        <!-- Search Results -->
        <div v-if="hasResults" class="search-results">
          <h4>Found {{ searchResults.length }} tile(s):</h4>
          <div class="results-list">
            <div
              v-for="tile in searchResults"
              :key="tile.get('Name')"
              class="result-item"
              @click="navigateToTile(tile)"
            >
              <div class="tile-name">{{ tile.get('Name') }}</div>
              <div class="tile-info">
                <span class="tile-coords"> {{ tile.get('Name') }} - Click to navigate </span>
              </div>
            </div>
          </div>
        </div>

        <!-- No Results -->
        <div v-if="noResults" class="no-results">
          <p>No tiles found matching "{{ searchQuery }}"</p>
          <p class="help-text">Try searching for partial tile names like "12S" or "13T"</p>
        </div>

        <!-- Help Text -->
        <div v-if="!hasResults && !noResults" class="help-text">
          <p>Search for Sentinel-2 tile names to quickly navigate to specific areas.</p>
          <p>Examples: 12SXA, 13TDE, 14SMB</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  max-width: 500px;
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
</style>
