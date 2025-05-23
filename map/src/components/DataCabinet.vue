<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import searchStacApi from '../functions/search-stac-api'
import { addStacLayer, removeStacLayer } from '../functions/add-stac-layer'
import type { Map } from 'ol'
import { Extent } from 'ol/extent'

interface SearchResult {
  id: string
  date: string
  cloudCover: number | string
  thumbnailUrl: string
  bounds: number[] | null
  tiffUrl: string
}

const props = defineProps<{
  map: Map
}>()

const searchResults = ref<SearchResult[]>([])
const searchStatus = ref('')
const isLoading = ref(false)
const hasMore = ref(false)
const currentMgrsTileId = ref<string | null>(null)
const activeTileId = ref<string | null>(null)
const secondActiveTileId = ref<string | null>(null)
const isAccordionOpen = ref(true)
const isSelectedAccordionOpen = ref(false)
const isCreatingProject = ref(false)
const projectMessage = ref<{ type: 'success' | 'error' | 'loading', text: string } | null>(null)
const projectTitle = ref(new Date().toISOString())
const drawnExtent = ref<Extent | null>(null)

// Function to handle search results
const handleSearchResults = async (mgrsTileId: string) => {
  isLoading.value = true
  searchStatus.value = `Searching for Sentinel-2 images in tile ${mgrsTileId}...`
  currentMgrsTileId.value = mgrsTileId

  try {
    const response = await searchStacApi(mgrsTileId)
    if (response) {
      searchResults.value = response.results
      hasMore.value = response.hasMore
      searchStatus.value = `Found ${response.results.length} images`
    }
  } catch (error: unknown) {
    console.error('DataCabinet: Error searching:', error)
    searchStatus.value = `Error searching: ${error instanceof Error ? error.message : 'Unknown error'}`
  } finally {
    isLoading.value = false
  }
}

// Function to load more results
const loadMore = async () => {
  if (!currentMgrsTileId.value) return

  isLoading.value = true
  try {
    const response = await searchStacApi(currentMgrsTileId.value, false)
    if (response) {
      searchResults.value = [...searchResults.value, ...response.results]
      hasMore.value = response.hasMore
    }
  } catch (error: unknown) {
    console.error('Error loading more results:', error)
    searchStatus.value = `Error loading more results: ${error instanceof Error ? error.message : 'Unknown error'}`
  } finally {
    isLoading.value = false
  }
}

const handleViewOnMap = (imageUrl: string, bounds: number[] | null, tileId: string, isSecondAccordion: boolean = false) => {
  if (isSecondAccordion) {
    // Prevent selecting the same tile as the first accordion
    if (tileId === activeTileId.value) {
      return;
    }

    if (secondActiveTileId.value === tileId) {
      // If clicking the active tile in second accordion, remove it
      removeStacLayer(props.map);
      secondActiveTileId.value = null;
    } else {
      // If clicking a different tile in second accordion
      removeStacLayer(props.map);
      if (bounds) {
        addStacLayer(props.map, imageUrl, bounds);
        secondActiveTileId.value = tileId;
      } else {
        console.error('No bounds available for this image');
      }
    }
  } else {
    if (activeTileId.value === tileId) {
      // If clicking the active tile in first accordion, remove it
      removeStacLayer(props.map);
      activeTileId.value = null;
      // Also remove from second accordion if it was selected there
      if (secondActiveTileId.value === tileId) {
        secondActiveTileId.value = null;
      }
    } else {
      // If clicking a different tile in first accordion
      removeStacLayer(props.map);
      if (bounds) {
        addStacLayer(props.map, imageUrl, bounds);
        activeTileId.value = tileId;
        // If this tile was selected in second accordion, remove it
        if (secondActiveTileId.value === tileId) {
          secondActiveTileId.value = null;
        }
      } else {
        console.error('No bounds available for this image');
      }
    }
  }
}

const toggleAccordion = () => {
  isAccordionOpen.value = !isAccordionOpen.value
}

const toggleSelectedAccordion = () => {
  if (activeTileId.value) {
    isSelectedAccordionOpen.value = !isSelectedAccordionOpen.value
  }
}

const getActiveTileThumbnail = (isSecond: boolean = false) => {
  const tileId = isSecond ? secondActiveTileId.value : activeTileId.value
  const activeTile = searchResults.value.find(result => result?.id === tileId)
  return activeTile?.thumbnailUrl
}

const getActiveTileDate = (isSecond: boolean = false) => {
  const tileId = isSecond ? secondActiveTileId.value : activeTileId.value
  const activeTile = searchResults.value.find(result => result?.id === tileId)
  return activeTile?.date
}

const getActiveTileCloudCover = (isSecond: boolean = false) => {
  const tileId = isSecond ? secondActiveTileId.value : activeTileId.value
  const activeTile = searchResults.value.find(result => result?.id === tileId)
  return activeTile?.cloudCover
}

// Function to set the drawn extent
const setDrawnExtent = (extent: Extent) => {
  drawnExtent.value = extent
}

const handleCompareTiles = async () => {
  if (!activeTileId.value || !secondActiveTileId.value) return

  isCreatingProject.value = true
  projectMessage.value = null

  try {
    const firstTile = searchResults.value.find(result => result.id === activeTileId.value)
    const secondTile = searchResults.value.find(result => result.id === secondActiveTileId.value)

    if (!firstTile || !secondTile) {
      throw new Error('Could not find selected tiles')
    }

    projectMessage.value = {
      type: 'loading',
      text: 'Creating project...'
    }

    // Create project
    const createResponse = await fetch('http://0.0.0.0:8000/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: projectTitle.value,
      })
    })

    if (!createResponse.ok) {
      throw new Error(`Failed to create project: ${createResponse.statusText}`)
    }

    projectMessage.value = {
      type: 'success',
      text: 'Project created'
    }

    const projectData = await createResponse.json()
    const projectId = projectData.id

    // Upload images
    projectMessage.value = {
      type: 'loading',
      text: 'Uploading images...'
    }

    const uploadPromises = [
      (async () => {
        const imageResponse = await fetch(firstTile.thumbnailUrl)
        const imageBlob = await imageResponse.blob()

        const formData = new FormData()
        formData.append('file', imageBlob)

        return fetch(`http://0.0.0.0:8000/projects/${projectId}/images/a`, {
          method: 'PUT',
          body: formData
        })
      })(),
      (async () => {
        const imageResponse = await fetch(secondTile.thumbnailUrl)
        const imageBlob = await imageResponse.blob()

        const formData = new FormData()
        formData.append('file', imageBlob)

        return fetch(`http://0.0.0.0:8000/projects/${projectId}/images/b`, {
          method: 'PUT',
          body: formData
        })
      })()
    ]

    const uploadResponses = await Promise.all(uploadPromises)
    const uploadErrors = uploadResponses.filter(response => !response.ok)

    if (uploadErrors.length > 0) {
      throw new Error('Failed to upload one or more images')
    }

    projectMessage.value = {
      type: 'loading',
      text: 'Running inference...'
    }
    const { models: [{ id: modelId }] } = await fetch(`http://0.0.0.0:8000`).then(res => res.json())
    // Run inference
    const inferenceResponse = await fetch(`http://0.0.0.0:8000/projects/${projectId}/inference`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        bbox: drawnExtent.value ?? [0,0,0,0],
        images: [firstTile.thumbnailUrl, secondTile.thumbnailUrl]
      })
    })

    if (!inferenceResponse.ok) {
      throw new Error(`Failed to run inference: ${inferenceResponse.statusText}`)
    }

    // Start polling for project status
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`http://0.0.0.0:8000/projects/${projectId}`)
        if (!statusResponse.ok) {
          throw new Error(`Failed to fetch project status: ${statusResponse.statusText}`)
        }

        const projectStatus = await statusResponse.json()

        if (projectStatus.status === 'completed') {
          clearInterval(pollInterval)

          // Fetch inference results
          const resultsResponse = await fetch(`http://0.0.0.0:8000/projects/${projectId}/inference`)
          if (!resultsResponse.ok) {
            throw new Error(`Failed to fetch inference results: ${resultsResponse.statusText}`)
          }

          const results = await resultsResponse.json()
          console.log('Inference results:', results)

          projectMessage.value = {
            type: 'success',
            text: 'Inference completed'
          }
          // Clear message after 3 seconds
          setTimeout(() => {
            projectMessage.value = null
          }, 3000)
        } else if (projectStatus.status === 'failed') {
          clearInterval(pollInterval)
          projectMessage.value = {
            type: 'error',
            text: 'Inference Failed to Process'
          }
          throw new Error('Project processing failed')
        }
        // If status is 'pending' or 'processing', continue polling
      } catch (error) {
        clearInterval(pollInterval)
        throw error
      }
    }, 10000) // Poll every 10 seconds

    // Clean up interval if component is unmounted
    onUnmounted(() => {
      clearInterval(pollInterval)
    })

  } catch (error) {
    console.error('Error:', error)
    projectMessage.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Failed to create project or upload images'
    }
  } finally {
    isCreatingProject.value = false
  }
}

// Expose methods to parent components
defineExpose({
  handleSearchResults,
  setDrawnExtent
})
</script>

<template>
  <div class="data-cabinet">
    <h2>Fields of the World: Inference App</h2>
    <p v-if="searchStatus === ''">Select a grid cell to search for Sentinel-2 images</p>
    <div class="search-status">{{ searchStatus }}</div>

    <div v-if="isLoading" class="loading">
      Loading...
    </div>

    <div v-else-if="searchResults.length > 0" class="results-container">
      <div class="selected-tile-header">{{ currentMgrsTileId }} Results</div>

      <!-- Action buttons section -->
      <div class="action-buttons">
        <div class="title-input">
          <label for="project-title" class="input-label">Project Title</label>
          <input
            id="project-title"
            type="text"
            v-model="projectTitle"
            placeholder="Enter project title"
            class="project-title-input"
          />
        </div>
        <div v-if="projectMessage" :class="['message', projectMessage.type]">
          {{ projectMessage.text }}
        </div>
        <button
          class="action-button"
          :disabled="!activeTileId || !secondActiveTileId || isCreatingProject"
          @click="handleCompareTiles"
        >
          <span v-if="isCreatingProject">Creating Project...</span>
          <span v-else>Run Inference</span>
        </button>
      </div>

      <div class="accordion-header" @click="toggleAccordion">
        <h3 class="active-tile-id">{{ activeTileId ? activeTileId : 'Select a tile' }}</h3>
        <span class="accordion-icon" :class="{ 'open': isAccordionOpen }">▼</span>
      </div>

      <transition name="accordion">
        <div v-show="isAccordionOpen" class="results">
          <template v-for="result in searchResults" :key="result?.id">
            <div
                class="result-item"
                :class="{ 'active': activeTileId === result?.id }"
                v-if="result?.id !== secondActiveTileId">
              <div class="result-thumbnail"
                  @click="handleViewOnMap(result.thumbnailUrl, result.bounds, result?.id, false)">
                <img :src="result.thumbnailUrl" alt="Preview" @error="($event.target as HTMLImageElement).style.display='none'">
              </div>
              <div class="result-header">
                <h3>{{ result?.id }}</h3>
              </div>
              <div class="result-details">
                <div>Date: {{ result.date }}</div>
                <div>Cloud Cover: {{ result.cloudCover }}%</div>
              </div>
            </div>
        </template>

          <button
            v-if="hasMore"
            @click="loadMore"
            class="load-more-button"
            :disabled="isLoading"
          >
            Load More
          </button>
        </div>
      </transition>

      <!-- Second Accordion for Selected Results -->
      <div class="selected-results-section" :class="{ 'disabled': !activeTileId }">
        <div class="accordion-header" @click="toggleSelectedAccordion" :class="{ 'disabled': !activeTileId }">
          <h3 class="active-tile-id">{{ secondActiveTileId ? secondActiveTileId : 'Select a Second Tile' }}</h3>
          <span class="accordion-icon" :class="{ 'open': isSelectedAccordionOpen }">▼</span>
        </div>

        <transition name="accordion">
          <div v-show="isSelectedAccordionOpen && activeTileId" class="results">
            <!-- Show first accordion's active tile first -->
            <div v-if="activeTileId" class="result-item active disabled">
              <div class="result-thumbnail">
                <img :src="getActiveTileThumbnail(false)" alt="Preview" @error="($event.target as HTMLImageElement).style.display='none'">
              </div>
              <div class="result-header">
                <h3>{{ activeTileId }}</h3>
              </div>
              <div class="result-details">
                <div>Date: {{ getActiveTileDate(false) }}</div>
                <div>Cloud Cover: {{ getActiveTileCloudCover(false) }}%</div>
              </div>
            </div>

            <!-- Show other results -->
              <template v-for="result in searchResults" :key="result?.id">
                <div
                    class="result-item"
                    :class="{ 'active': secondActiveTileId === result?.id }"
                    v-if="result?.id !== activeTileId">
                  <div class="result-thumbnail"
                      @click="handleViewOnMap(result.thumbnailUrl, result.bounds, result?.id, true)">
                    <img :src="result.thumbnailUrl" alt="Preview" @error="($event.target as HTMLImageElement).style.display='none'">
                  </div>
                  <div class="result-header">
                    <h3>{{ result?.id }}</h3>
                  </div>
                  <div class="result-details">
                    <div>Date: {{ result.date }}</div>
                    <div>Cloud Cover: {{ result.cloudCover }}%</div>
                  </div>
                </div>
              </template>
            </div>
        </transition>
      </div>
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

.results-container {
  margin-top: 1rem;
  height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
}

.selected-tile-header {
  padding: 0.75rem;
  color: white;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.selected-tile-preview {
  margin-bottom: 1rem;
  background-color: rgba(0, 136, 136, 0.2);
  border: 1px solid rgba(0, 136, 136, 0.8);
  border-radius: 4px;
  overflow: hidden;
}

.selected-tile-preview img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.selected-tile-info {
  padding: 0.75rem;
  color: white;
  font-size: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background-color: rgba(0, 0, 0, 0.3);
}

.accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background-color: rgba(0, 136, 136, 0.2);
  border: 1px solid rgba(0, 136, 136, 0.8);
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 0.5rem;
}

.accordion-header h3 {
  margin: 0;
  font-size: 1rem;
  color: white;
}

.active-tile-id {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.accordion-icon {
  color: white;
  transition: transform 0.3s ease;
  font-size: 0.75rem;
}

.accordion-icon.open {
  transform: rotate(180deg);
}

.results {
  flex: 1;
  overflow-y: auto;
  transition: opacity 0.3s ease;
}

.accordion-enter-active,
.accordion-leave-active {
  transition: opacity 0.3s ease;
}

.accordion-enter-from,
.accordion-leave-to {
  opacity: 0;
}

.result-item {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.result-item:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.result-item.active {
  background-color: rgba(0, 136, 136, 0.2);
  border-color: rgba(0, 136, 136, 0.8);
  box-shadow: 0 0 10px rgba(0, 136, 136, 0.4);
}

.result-thumbnail {
  width: 100%;
  height: 150px;
  overflow: hidden;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-thumbnail:hover {
  transform: scale(1.02);
}

.result-thumbnail.active {
  border-color: rgba(0, 136, 136, 0.8);
  box-shadow: 0 0 10px rgba(0, 136, 136, 0.4);
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

.selected-results-section {
  margin-top: 1rem;
}

.selected-results-section.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.accordion-header.disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.result-item.disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.result-item.disabled .result-thumbnail {
  cursor: not-allowed;
}

.action-buttons {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
}

.message {
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  text-align: center;
}

.message.success {
  background-color: rgba(0, 255, 0, 0.1);
  border: 1px solid rgba(0, 255, 0, 0.3);
  color: #00ff00;
}

.message.error {
  background-color: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
  color: #ff0000;
}

.action-button {
  width: 100%;
  padding: 0.75rem;
  background-color: rgba(0, 136, 136, 0.8);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 2.5rem;
}

.action-button:hover:not(:disabled) {
  background-color: rgba(0, 136, 136, 1);
}

.action-button:disabled {
  background-color: rgba(0, 136, 136, 0.4);
  cursor: not-allowed;
}

.title-input {
  margin-bottom: 0.75rem;
  width: 100%;
}

.input-label {
  display: block;
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.875rem;
}

.project-title-input {
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

.project-title-input:focus {
  outline: none;
  border-color: rgba(0, 136, 136, 0.8);
  background-color: rgba(255, 255, 255, 0.15);
}

.project-title-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}
</style>
