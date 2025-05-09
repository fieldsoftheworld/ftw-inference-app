<script setup lang="ts">
import { ref } from 'vue'
import searchStacApi from '../functions/search-stac-api'
import { addStacLayer, removeStacLayer } from '../functions/add-stac-layer'
import type { Map } from 'ol'

const props = defineProps<{
  map: Map
}>()

const searchResults = ref<any[]>([])
const searchStatus = ref('')
const isLoading = ref(false)
const hasMore = ref(false)
const currentMgrsTileId = ref<string | null>(null)

// Function to handle search results
const handleSearchResults = async (mgrsTileId: string) => {
  console.log('DataCabinet: handleSearchResults called with', mgrsTileId)
  isLoading.value = true
  searchStatus.value = `Searching for Sentinel-2 images in tile ${mgrsTileId}...`
  currentMgrsTileId.value = mgrsTileId

  try {
    const { results, hasMore: moreResults } = await searchStacApi(mgrsTileId)
    console.log('DataCabinet: Search results received:', results)
    searchResults.value = results
    hasMore.value = moreResults
    searchStatus.value = `Found ${results.length} images`
  } catch (error) {
    console.error('DataCabinet: Error searching:', error)
    searchStatus.value = `Error searching: ${error.message}`
  } finally {
    isLoading.value = false
  }
}

// Function to load more results
const loadMore = async () => {
  if (!currentMgrsTileId.value) return

  isLoading.value = true
  try {
    const { results, hasMore: moreResults } = await searchStacApi(currentMgrsTileId.value, false)
    searchResults.value = [...searchResults.value, ...results]
    hasMore.value = moreResults
  } catch (error) {
    console.error('Error loading more results:', error)
    searchStatus.value = `Error loading more results: ${error.message}`
  } finally {
    isLoading.value = false
  }
}

const handleViewOnMap = (imageUrl: string, bounds: number[] | null) => {
  console.log('handleViewOnMap called with:', { imageUrl, bounds });
  if (bounds) {
    console.log('Bounds available, adding layer');
    addStacLayer(props.map, imageUrl, bounds);
  } else {
    console.error('No bounds available for this image');
  }
}

const handleRemoveLayer = () => {
  removeStacLayer(props.map)
}

// Expose the search function to parent components
defineExpose({
  handleSearchResults
})
</script>

<template>
  <div class="data-cabinet">
    <h2>Data Cabinet</h2>
    <div class="search-status">{{ searchStatus }}</div>

    <div v-if="isLoading" class="loading">
      Loading...
    </div>

    <div v-else class="results">
      <div v-for="result in searchResults" :key="result.id" class="result-item">
        <div class="result-thumbnail">
          <img :src="result.thumbnailUrl" alt="Preview" @error="$event.target.style.display='none'">
        </div>
        <div class="result-header">
          <h3>{{ result.id }}</h3>
          <div class="result-actions">
            <button @click="handleViewOnMap(result.thumbnailUrl, result.bounds)" class="action-button">
              View on Map
            </button>
            <button @click="handleRemoveLayer" class="action-button">
              Remove Layer
            </button>
          </div>
        </div>
        <div class="result-details">
          <div>Date: {{ result.date }}</div>
          <div>Cloud Cover: {{ result.cloudCover }}%</div>
        </div>
      </div>

      <button
        v-if="hasMore"
        @click="loadMore"
        class="load-more-button"
        :disabled="isLoading"
      >
        Load More
      </button>
    </div>
  </div>
</template>

<style scoped>
.data-cabinet {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 300px;
  max-height: calc(100vh - 2rem);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 1rem;
  border-radius: 4px;
  overflow-y: auto;
  z-index: 1000;
}

h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  color: white;
}

.search-status {
  margin-bottom: 1rem;
  font-style: italic;
  color: rgba(255, 255, 255, 0.8);
}

.loading {
  text-align: center;
  padding: 1rem;
  color: rgba(255, 255, 255, 0.8);
}

.results {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.result-item {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.result-thumbnail {
  width: 100%;
  height: 150px;
  overflow: hidden;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.2);
}

.result-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.result-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.result-header h3 {
  margin: 0;
  font-size: 1rem;
  color: white;
  word-break: break-word;
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.action-button {
  background-color: rgba(0, 136, 136, 0.8);
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  text-decoration: none;
  white-space: nowrap;
  flex: 1;
  min-width: 80px;
  text-align: center;
}

.action-button:hover {
  background-color: rgba(0, 136, 136, 1);
}

.result-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.load-more-button {
  background-color: rgba(0, 136, 136, 0.8);
  color: white;
  border: none;
  padding: 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  margin-top: 1rem;
  font-size: 0.875rem;
}

.load-more-button:hover {
  background-color: rgba(0, 136, 136, 1);
}

.load-more-button:disabled {
  background-color: rgba(0, 136, 136, 0.4);
  cursor: not-allowed;
}
</style>
