<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import type { Map } from 'ol'
import type { Extent } from 'ol/extent'
import searchStacApi from '../functions/search-stac-api'
import { addStacLayer, removeStacLayer } from '../functions/add-stac-layer'
import { generateJWT } from '../functions/generate-jwt'

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
const projectMessage = ref<{ type: 'success' | 'error' | 'loading'; text: string } | null>(null)
const projectTitle = ref(new Date().toISOString())
const drawnExtent = ref<Extent | null>(null)
const isFirstResultsOpen = ref(false)
const isSecondResultsOpen = ref(false)

const toggleAccordion = () => {
  emit('update:isOpen', !props.isOpen)
}

const toggleFirstResults = () => {
  isFirstResultsOpen.value = !isFirstResultsOpen.value
}

const toggleSecondResults = () => {
  isSecondResultsOpen.value = !isSecondResultsOpen.value
}

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
  projectMessage.value = null

  try {
    const firstTile = searchResults.value.find((result) => result.id === activeTileId.value)
    const secondTile = searchResults.value.find((result) => result.id === secondActiveTileId.value)

    if (!firstTile || !secondTile) {
      throw new Error('Could not find selected tiles')
    }

    projectMessage.value = {
      type: 'loading',
      text: 'Creating project...',
    }

    const token = generateJWT()

    // Create project
    const createResponse = await fetch('http://0.0.0.0:8000/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: projectTitle.value,
      }),
    })

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

        return fetch(`http://0.0.0.0:8000/projects/${projectId}/images/a`, {
          method: 'PUT',
          headers: {
            'Access-Control-Allow-Origin': '*',
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

        return fetch(`http://0.0.0.0:8000/projects/${projectId}/images/b`, {
          method: 'PUT',
          headers: {
            'Access-Control-Allow-Origin': '*',
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })
      })(),
    ]

    const uploadResponses = await Promise.all(uploadPromises)
    const uploadErrors = uploadResponses.filter((response) => !response.ok)

    if (uploadErrors.length > 0) {
      throw new Error('Failed to upload one or more images')
    }

    projectMessage.value = {
      type: 'loading',
      text: 'Running inference...',
    }
    const {
      models: [{ id: modelId }],
    } = await fetch(`http://0.0.0.0:8000`, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        Authorization: `Bearer ${token}`,
      },
    }).then((res) => res.json())

    // Run inference
    const inferenceResponse = await fetch(`http://0.0.0.0:8000/projects/${projectId}/inference`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: modelId,
        bbox: drawnExtent.value ?? [0, 0, 0, 0],
        images: [firstTile.thumbnailUrl, secondTile.thumbnailUrl],
      }),
    })

    if (!inferenceResponse.ok) {
      throw new Error(`Failed to run inference: ${inferenceResponse.statusText}`)
    }

    // Start polling for project status
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`http://0.0.0.0:8000/projects/${projectId}`, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            Authorization: `Bearer ${token}`,
          },
        })
        if (!statusResponse.ok) {
          throw new Error(`Failed to fetch project status: ${statusResponse.statusText}`)
        }

        const projectStatus = await statusResponse.json()

        if (projectStatus.status === 'completed') {
          clearInterval(pollInterval)

          // Fetch inference results
          const resultsResponse = await fetch(
            `http://0.0.0.0:8000/projects/${projectId}/inference`,
            {
              headers: {
                'Access-Control-Allow-Origin': '*',
                Authorization: `Bearer ${token}`,
              },
            },
          )
          if (!resultsResponse.ok) {
            throw new Error(`Failed to fetch inference results: ${resultsResponse.statusText}`)
          }

          const results = await resultsResponse.json()
          console.log('Inference results:', results)

          projectMessage.value = {
            type: 'success',
            text: 'Inference completed',
          }
          // Clear message after 3 seconds
          setTimeout(() => {
            projectMessage.value = null
          }, 3000)
        } else if (projectStatus.status === 'failed') {
          clearInterval(pollInterval)
          projectMessage.value = {
            type: 'error',
            text: 'Inference Failed to Process',
          }
          throw new Error('Project processing failed')
        }
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
      text: error instanceof Error ? error.message : 'Failed to create project or upload images',
    }
  } finally {
    isCreatingProject.value = false
  }
}

// Expose methods to parent components
defineExpose({
  handleSearchResults,
  setDrawnExtent,
  currentMgrsTileId,
})
</script>

<template>
  <div>
    <div class="accordion-header" @click="toggleAccordion">
      <h3>Run Inference</h3>
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
                      @error="($event.target as HTMLImageElement).style.display = 'none'"
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
                      @error="($event.target as HTMLImageElement).style.display = 'none'"
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
                        @error="($event.target as HTMLImageElement).style.display = 'none'"
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
  max-height: calc(100vh - 400px);
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
