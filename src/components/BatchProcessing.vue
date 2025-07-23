<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import type { Map } from 'ol'
import type { Extent } from 'ol/extent'
import searchStacApi from '../functions/search-stac-api'
import { addStacLayer, removeStacLayer } from '../functions/add-stac-layer'
import { generateJWT } from '../functions/generate-jwt'
import { transformExtent } from 'ol/proj'

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
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
}>()

const searchResults = ref<SearchResult[]>([])
const searchStatus = ref('')
const isLoading = ref(false)
const hasMore = ref(false)
const currentMgrsTileId = ref<string | null>(null)
const activeTileId = ref<string | null>(null)
const secondActiveTileId = ref<string | null>(null)
const isCreatingProject = ref(false)
const projectMessage = ref<{
  type: 'success' | 'error' | 'loading' | 'warning'
  text: string
} | null>(null)
const projectTitle = ref(new Date().toISOString())
const drawnExtent = ref<Extent | null>(null)
const isFirstResultsOpen = ref(false)
const isSecondResultsOpen = ref(false)
const retryTimeout = ref<number | null>(null)
const currentBbox = ref<number[] | undefined>(undefined)

const toggleAccordion = () => {
  emit('update:isOpen', !props.isOpen)
}

const toggleFirstResults = () => {
  isFirstResultsOpen.value = !isFirstResultsOpen.value
  isSecondResultsOpen.value = !isFirstResultsOpen.value // Close second results if first is opened
}

const toggleSecondResults = () => {
  isSecondResultsOpen.value = !isSecondResultsOpen.value
  isFirstResultsOpen.value = !isSecondResultsOpen.value // Close first results if second is opened
}

// Function to handle search results
const handleSearchResults = async (mgrsTileId: string, bbox?: number[]) => {
  isLoading.value = true
  searchStatus.value = `Searching for Sentinel-2 images in tile ${mgrsTileId}...`
  currentMgrsTileId.value = mgrsTileId
  currentBbox.value = bbox

  try {
    const response = await searchStacApi(bbox)
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
    const response = await searchStacApi(currentBbox.value, false)
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

const handleViewOnMap = (
  imageUrl: string,
  bounds: number[] | null,
  tileId: string,
  isSecondAccordion: boolean = false,
) => {
  if (isSecondAccordion) {
    if (tileId === activeTileId.value) {
      return
    }

    if (secondActiveTileId.value === tileId) {
      removeStacLayer(props.map)
      secondActiveTileId.value = null
    } else {
      removeStacLayer(props.map)
      if (bounds) {
        addStacLayer(props.map, imageUrl, bounds)
        secondActiveTileId.value = tileId
      } else {
        console.error('No bounds available for this image')
      }
    }
  } else {
    if (activeTileId.value === tileId) {
      removeStacLayer(props.map)
      activeTileId.value = null
      if (secondActiveTileId.value === tileId) {
        secondActiveTileId.value = null
      }
    } else {
      removeStacLayer(props.map)
      if (bounds) {
        addStacLayer(props.map, imageUrl, bounds)
        activeTileId.value = tileId
        if (secondActiveTileId.value === tileId) {
          secondActiveTileId.value = null
        }
      } else {
        console.error('No bounds available for this image')
      }
    }
  }
}

const getActiveTileThumbnail = (isSecond: boolean = false) => {
  const tileId = isSecond ? secondActiveTileId.value : activeTileId.value
  const activeTile = searchResults.value.find((result) => result?.id === tileId)
  return activeTile?.thumbnailUrl
}

const getActiveTileDate = (isSecond: boolean = false) => {
  const tileId = isSecond ? secondActiveTileId.value : activeTileId.value
  const activeTile = searchResults.value.find((result) => result?.id === tileId)
  return activeTile?.date
}

const getActiveTileCloudCover = (isSecond: boolean = false) => {
  const tileId = isSecond ? secondActiveTileId.value : activeTileId.value
  const activeTile = searchResults.value.find((result) => result?.id === tileId)
  return activeTile?.cloudCover
}

const setDrawnExtent = (extent: Extent) => {
  drawnExtent.value = extent
}

const handleCompareTiles = async () => {
  if (!activeTileId.value || !secondActiveTileId.value) return

  isCreatingProject.value = true
  projectMessage.value = {
    type: 'warning',
    text: 'Batch processing may take up to 30 seconds to complete...',
  }

  try {
    const firstTile = searchResults.value.find((result) => result.id === activeTileId.value)
    const secondTile = searchResults.value.find((result) => result.id === secondActiveTileId.value)

    if (!firstTile || !secondTile) {
      throw new Error('Could not find selected tiles')
    }

    projectMessage.value = {
      type: 'loading',
      text: 'Creating batch processing project...',
    }

    const token = generateJWT()

    // Create project
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

    const createResponse = await fetch(`${apiBaseUrl}projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: projectTitle.value,
      }),
    })

    if (createResponse.status === 503) {
      // Server is busy, schedule retry
      projectMessage.value = {
        type: 'error',
        text: 'Server is busy. Retrying in 15 seconds...',
      }
      isCreatingProject.value = false

      // Clear any existing timeout
      if (retryTimeout.value) {
        clearTimeout(retryTimeout.value)
      }

      // Schedule retry after 15 seconds
      retryTimeout.value = window.setTimeout(() => {
        handleCompareTiles()
      }, 15000)
      return
    }

    if (!createResponse.ok) {
      throw new Error(`Failed to create project: ${createResponse.statusText}`)
    }

    projectMessage.value = {
      type: 'success',
      text: 'Project created',
    }

    const projectData = await createResponse.json()
    const projectId = projectData.id

    // Upload images
    projectMessage.value = {
      type: 'loading',
      text: 'Uploading images...',
    }

    const uploadPromises = [
      (async () => {
        const imageResponse = await fetch(firstTile.thumbnailUrl)
        const imageBlob = await imageResponse.blob()

        const formData = new FormData()
        formData.append('file', imageBlob)

        return fetch(`${apiBaseUrl}projects/${projectId}/images/a`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })
      })(),
      (async () => {
        const imageResponse = await fetch(secondTile.thumbnailUrl)
        const imageBlob = await imageResponse.blob()

        const formData = new FormData()
        formData.append('file', imageBlob)

        return fetch(`${apiBaseUrl}projects/${projectId}/images/b`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })
      })(),
    ]

    const uploadResponses = await Promise.all(uploadPromises)

    // Check for 503 errors in upload responses
    const upload503Errors = uploadResponses.filter((response) => response.status === 503)
    if (upload503Errors.length > 0) {
      // Server is busy, schedule retry
      projectMessage.value = {
        type: 'error',
        text: 'Server is busy. Retrying in 15 seconds...',
      }
      isCreatingProject.value = false

      // Clear any existing timeout
      if (retryTimeout.value) {
        clearTimeout(retryTimeout.value)
      }

      // Schedule retry after 15 seconds
      retryTimeout.value = window.setTimeout(() => {
        handleCompareTiles()
      }, 15000)
      return
    }

    const uploadErrors = uploadResponses.filter((response) => !response.ok)

    if (uploadErrors.length > 0) {
      throw new Error('Failed to upload one or more images')
    }

    projectMessage.value = {
      type: 'loading',
      text: 'Running batch processing...',
    }
    const {
      models: [{ id: modelId }],
    } = await fetch(`${apiBaseUrl}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }).then((res) => res.json())

    if (!drawnExtent.value) {
      throw new Error('Drawn extent is not set')
    }

    // Batch Processing
    const batchProcessingResponse = await fetch(`${apiBaseUrl}projects/${projectId}/inference`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: modelId,
        bbox: transformExtent(drawnExtent.value, 'EPSG:3857', 'EPSG:4326'),
        images: [firstTile.thumbnailUrl, secondTile.thumbnailUrl],
      }),
    })

    if (batchProcessingResponse.status === 503) {
      // Server is busy, schedule retry
      projectMessage.value = {
        type: 'error',
        text: 'Server is busy. Retrying in 15 seconds...',
      }
      isCreatingProject.value = false

      // Clear any existing timeout
      if (retryTimeout.value) {
        clearTimeout(retryTimeout.value)
      }

      // Schedule retry after 15 seconds
      retryTimeout.value = window.setTimeout(() => {
        handleCompareTiles()
      }, 15000)
      return
    }

    if (!batchProcessingResponse.ok) {
      throw new Error(`Failed to process batch: ${batchProcessingResponse.statusText}`)
    }

    // Start polling for project status
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`${apiBaseUrl}projects/${projectId}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })
        if (!statusResponse.ok) {
          throw new Error(`Failed to fetch project status: ${statusResponse.statusText}`)
        }

        const projectStatus = await statusResponse.json()

        if (projectStatus.status === 'completed') {
          clearInterval(pollInterval)

          // Fetch batch processing results
          const resultsResponse = await fetch(`${apiBaseUrl}projects/${projectId}/inference`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          })
          if (!resultsResponse.ok) {
            throw new Error(
              `Failed to fetch batch processing results: ${resultsResponse.statusText}`,
            )
          }

          const results = await resultsResponse.json()
          console.log('Batch processing results:', results)

          projectMessage.value = {
            type: 'success',
            text: 'Batch processing completed',
          }
          // Clear message after 3 seconds
          setTimeout(() => {
            projectMessage.value = null
          }, 3000)
        } else if (projectStatus.status === 'failed') {
          clearInterval(pollInterval)
          projectMessage.value = {
            type: 'error',
            text: 'Batch processing failed to process',
          }
          throw new Error('Batch processing failed')
        }
      } catch (error) {
        clearInterval(pollInterval)
        throw error
      }
    }, 10000) // Poll every 10 seconds

    // Clean up interval if component is unmounted
    onUnmounted(() => {
      clearInterval(pollInterval)
      // Clean up retry timeout
      if (retryTimeout.value) {
        clearTimeout(retryTimeout.value)
      }
    })
  } catch (error) {
    console.error('Error:', error)
    projectMessage.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Failed to create project or upload images',
    }
  } finally {
    isCreatingProject.value = false
    // Clear message after 3 seconds (only for non-retry cases)
    if (retryTimeout.value === null) {
      setTimeout(() => {
        if (projectMessage.value?.type === 'error') {
          projectMessage.value = null
        }
      }, 3000)
    }
  }
}

const handleBboxSizeWarning = (message: string) => {
  projectMessage.value = {
    type: 'error',
    text: message,
  }
  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    if (projectMessage.value?.type === 'error') {
      projectMessage.value = null
    }
  }, 3000)
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  const originalSrc = img.src

  // For Earth Search thumbnails, try to use the visual asset instead
  if (originalSrc.includes('earth-search.aws.element84.com') && originalSrc.includes('thumbnail')) {
    // Replace thumbnail with visual asset URL
    const visualUrl = originalSrc.replace('/thumbnail', '/visual')
    img.src = visualUrl
    console.log('Trying visual asset instead of thumbnail:', visualUrl)
  } else {
    // Hide the image if all attempts fail
    img.style.display = 'none'
    console.log('Image failed to load:', originalSrc)
  }
}

const dismissMessage = () => {
  projectMessage.value = null
}

// Expose methods to parent components
defineExpose({
  handleSearchResults,
  setDrawnExtent,
  currentMgrsTileId,
  handleBboxSizeWarning,
})
</script>

<template>
  <div>
    <div class="accordion-header" @click="toggleAccordion">
      <h3>Batch Processing</h3>
      <span class="accordion-icon" :class="{ open: isOpen }">▼</span>
    </div>

    <transition name="accordion">
      <div v-show="isOpen">
        <p v-if="searchStatus === ''">Select a grid cell to search for Sentinel-2 images</p>
        <div class="search-status">{{ searchStatus }}</div>

        <div v-if="isLoading" class="loading">Loading...</div>

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
              <button
                v-if="projectMessage.type === 'error'"
                class="close-button"
                @click="dismissMessage"
              >
                ×
              </button>
            </div>
            <button
              class="action-button"
              :disabled="!activeTileId || !secondActiveTileId || isCreatingProject"
              @click="handleCompareTiles"
            >
              <span v-if="isCreatingProject">Creating Project...</span>
              <span v-else>Run Batch Processing</span>
            </button>
          </div>

          <div class="accordion-header" @click="toggleFirstResults">
            <h3 class="active-tile-id">{{ activeTileId ? activeTileId : 'Select a tile' }}</h3>
            <span class="accordion-icon" :class="{ open: isFirstResultsOpen }">▼</span>
          </div>

          <transition name="accordion">
            <div v-show="isFirstResultsOpen" class="results">
              <template v-for="result in searchResults" :key="result?.id">
                <div
                  class="result-item"
                  :class="{ active: activeTileId === result?.id }"
                  v-if="result?.id !== secondActiveTileId"
                >
                  <div
                    class="result-thumbnail"
                    @click="handleViewOnMap(result.thumbnailUrl, result.bounds, result?.id, false)"
                  >
                    <img
                      :src="result.thumbnailUrl"
                      alt="Preview"
                      @error="handleImageError"
                      crossorigin="anonymous"
                    />
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
          <div class="selected-results-section" :class="{ disabled: !activeTileId }">
            <div
              class="accordion-header"
              @click="toggleSecondResults"
              :class="{ disabled: !activeTileId }"
            >
              <h3 class="active-tile-id">
                {{ secondActiveTileId ? secondActiveTileId : 'Select a Second Tile' }}
              </h3>
              <span class="accordion-icon" :class="{ open: isSecondResultsOpen }">▼</span>
            </div>

            <transition name="accordion">
              <div v-show="isSecondResultsOpen && activeTileId" class="results">
                <!-- Show first accordion's active tile first -->
                <div v-if="activeTileId" class="result-item active disabled">
                  <div class="result-thumbnail">
                    <img
                      :src="getActiveTileThumbnail(false)"
                      alt="Preview"
                      @error="handleImageError"
                      crossorigin="anonymous"
                    />
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
                    :class="{ active: secondActiveTileId === result?.id }"
                    v-if="result?.id !== activeTileId"
                  >
                    <div
                      class="result-thumbnail"
                      @click="handleViewOnMap(result.thumbnailUrl, result.bounds, result?.id, true)"
                    >
                      <img
                        :src="result.thumbnailUrl"
                        alt="Preview"
                        @error="handleImageError"
                        crossorigin="anonymous"
                      />
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
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: rgba(0, 136, 136, 0.2);
  border: 1px solid rgba(0, 136, 136, 0.8);
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 0.125rem;
}

.accordion-header h3 {
  margin: 0;
  font-size: 1rem;
  color: white;
}

.accordion-icon {
  color: white;
  transition: transform 0.3s ease;
  font-size: 0.75rem;
}

.accordion-icon.open {
  transform: rotate(180deg);
}

.results-container {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
  height: 100%;
}

.results {
  flex: 1;
  overflow-y: auto;
  transition: opacity 0.3s ease;
  min-height: 0;
  max-height: calc(100vh - 490px);
}

.selected-tile-header {
  padding: 0.25rem;
  color: white;
  font-weight: 500;
}

.action-buttons {
  margin-bottom: 0.25rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  flex-shrink: 0;
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
  padding: 0.5rem;
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

.message {
  margin-bottom: 0.5rem;
  padding: 0.25rem;
  border-radius: 4px;
  font-size: 0.875rem;
  text-align: center;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
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

.message.warning {
  background-color: rgba(255, 255, 0, 0.1);
  border: 1px solid rgba(255, 255, 0, 0.3);
  color: #ffff00;
}

.message.loading {
  background-color: rgba(0, 136, 136, 0.1);
  border: 1px solid rgba(0, 136, 136, 0.3);
  color: #00ffff;
}

.close-button {
  position: absolute;
  right: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: inherit;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0 0.5rem;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.close-button:hover {
  opacity: 1;
}

.action-button {
  width: 100%;
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
  padding: 0.25rem;
}

.action-button:hover:not(:disabled) {
  background-color: rgba(0, 136, 136, 1);
}

.action-button:disabled {
  background-color: rgba(0, 136, 136, 0.4);
  cursor: not-allowed;
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
  margin-top: auto;
  position: sticky;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  padding-top: 0.5rem;
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

.active-tile-id {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
