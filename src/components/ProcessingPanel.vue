<script setup lang="ts">
import { ref, onUnmounted, watch, shallowRef } from 'vue'
import type Map from 'ol/Map'
import type { Extent } from 'ol/extent'
import { generateJWT } from '../functions/generate-jwt'
import { transformExtent } from 'ol/proj'
import { showWarning } from '../functions/snackbar'
import searchStacApi from '../functions/search-stac-api'
import { useSearch } from '../composables/useSearch'
import { useProjectMessage } from '../composables/useProjectMessage'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { FeatureCollection } from 'geojson'
import { useStacLayer } from '../composables/useStacLayer'
import { useAreaOfInterest } from '../composables/useAreaOfInterest'

const props = defineProps<{
  map: Map
  isOpen: boolean
  processingMode: 'smallAreaProcessing' | 'batchProcessing' | null
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
}>()

const { addStacLayer, removeStacLayer } = useStacLayer()
const { removeExtentInteraction, drawnExtent } = useAreaOfInterest()
const { projectMessage, dismissMessage } = useProjectMessage()

const { currentBbox, hasMore, isLoading, searchResults, searchStatus } = useSearch()
const { currentGridExtent, currentMgrsTileId, activeTileId, secondActiveTileId } =
  useAreaOfInterest()

const isOpen = ref(props.isOpen)
const processingMode = ref(props.processingMode)
watch(
  () => props.processingMode,
  (newValue) => {
    processingMode.value = newValue
  },
)

const isCreatingProject = ref(false)
const isProcessing = ref(false)
const projectTitle = ref(new Date().toISOString())
const isFirstResultsOpen = ref(false)
const isSecondResultsOpen = ref(false)
const retryTimeout = ref<number | null>(null)
const vectorLayer = shallowRef<VectorLayer<VectorSource> | null>(null)

const toggleAccordion = () => {
  isOpen.value = !isOpen.value
  emit('update:isOpen', isOpen.value)
}

const toggleFirstResults = () => {
  isFirstResultsOpen.value = !isFirstResultsOpen.value
  isSecondResultsOpen.value = !isFirstResultsOpen.value // Close second results if first is opened
}

const toggleSecondResults = () => {
  isSecondResultsOpen.value = !isSecondResultsOpen.value
  isFirstResultsOpen.value = !isSecondResultsOpen.value // Close first results if second is opened
}

// Function to load more results
const loadMore = async () => {
  if (!currentMgrsTileId.value) return

  isLoading.value = true
  try {
    // For loadMore, we need to pass the same settings as the initial search
    // Get current settings from localStorage since that's where they're stored
    const stored = localStorage.getItem('ftw-search-settings')
    let currentSettings = {
      startDate: '',
      endDate: '',
      cloudCover: 10,
      areaCoverage: 60,
    }

    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        currentSettings = {
          startDate: parsed.startDate || '',
          endDate: parsed.endDate || '',
          cloudCover: parsed.cloudCover || 10,
          areaCoverage: parsed.areaCoverage || 60,
        }
      } catch (error) {
        console.error('Error parsing stored settings:', error)
      }
    }

    const response = await searchStacApi(currentBbox.value, false, currentSettings)
    if (response) {
      searchResults.value = [...searchResults.value, ...response.results]
      hasMore.value = response.hasMore

      if (response.results.length === 0) {
        searchStatus.value = `No more images found. Try adjusting your filters (date range, cloud cover, area coverage) to increase the likelihood of finding more results.`
      }
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
  // Use the stored currentGridExtent for positioning the STAC layer
  const gridExtent = currentGridExtent.value || bounds

  // Find the selected tile to check its area coverage
  const selectedTile = searchResults.value.find((result) => result.id === tileId)

  // Check area coverage and show warning if less than 100%
  if (selectedTile && selectedTile.areaCoverage !== undefined) {
    const areaCoverage =
      typeof selectedTile.areaCoverage === 'number'
        ? selectedTile.areaCoverage
        : parseFloat(selectedTile.areaCoverage as string)

    if (!isNaN(areaCoverage) && areaCoverage <= 99.9) {
      showWarning(
        `Selected tile has only ${areaCoverage.toFixed(1)}% area coverage. Be sure to select an area where there is imagery coverage.`,
      )
    }
  }

  if (isSecondAccordion) {
    if (tileId === activeTileId.value) {
      return
    }

    if (secondActiveTileId.value === tileId) {
      removeStacLayer(props.map)
      secondActiveTileId.value = null
    } else {
      removeStacLayer(props.map)
      if (gridExtent) {
        addStacLayer(props.map, imageUrl, gridExtent)
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
      if (gridExtent) {
        addStacLayer(props.map, imageUrl, gridExtent)
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

const getActiveTileAreaCoverage = (isSecond: boolean = false) => {
  const tileId = isSecond ? secondActiveTileId.value : activeTileId.value
  const activeTile = searchResults.value.find((result) => result?.id === tileId)
  return activeTile?.areaCoverage
}

const getActiveTileGeometry = (isSecond: boolean = false) => {
  const tileId = isSecond ? secondActiveTileId.value : activeTileId.value
  const activeTile = searchResults.value.find((result) => result?.id === tileId)
  return activeTile?.geometry
}

const formatAreaCoverage = (coverage: number | string | undefined) => {
  if (coverage === undefined) return undefined
  if (typeof coverage === 'number') {
    return coverage.toFixed(1)
  }
  return coverage
}

const fitMapToBbox = (bbox: number[]) => {
  const extent: Extent = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857')
  // TODO: FIX ISSUE WITH SCROLLING AND CHANGE LAYER COLOR
  props.map.getView().fit(extent, {
    padding: [50, 50, 50, 50],
    duration: 500,
  })
}

const displayGeoJSON = (geojson: FeatureCollection & { crs: { properties: { name: string } } }) => {
  // Remove existing vector layer if it exists
  if (vectorLayer.value) {
    props.map.removeLayer(vectorLayer.value)
  }

  // Create new vector source and layer
  const source = new VectorSource({
    features: new GeoJSON({
      dataProjection: geojson.crs.properties.name,
      featureProjection: 'EPSG:3857',
    }).readFeatures(geojson),
  })

  vectorLayer.value = new VectorLayer({
    source: source,
    style: {
      'fill-color': 'rgba(0, 136, 136, 0.1)',
      'stroke-color': 'rgba(0, 136, 136, 1)',
      'stroke-width': 2,
    },
  })

  props.map.addLayer(vectorLayer.value)
  return transformExtent(source.getExtent(), 'EPSG:3857', 'EPSG:4326')
}

const handleSmallAreaProcessingRequest = async () => {
  if (!drawnExtent.value) {
    showWarning('Please draw an extent on the map before processing.')
    return
  }
  const firstTile = searchResults.value.find((result) => result.id === activeTileId.value)
  const secondTile = searchResults.value.find((result) => result.id === secondActiveTileId.value)

  if (!firstTile || !secondTile) {
    throw new Error('Could not find selected tiles')
  }

  isProcessing.value = true
  projectMessage.value = { type: 'loading', text: 'Processing small area...' }
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  try {
    const token = generateJWT()
    const response = await fetch(`${apiBaseUrl}example`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        inference: {
          model: '2_Class_FULL_FTW_Pretrained',
          images: [firstTile.itemUrl, secondTile.itemUrl],
          bbox: transformExtent(drawnExtent.value, 'EPSG:3857', 'EPSG:4326'),
        },
        polygons: {
          close_interiors: true,
        },
      }),
    })

    if (response.status === 503) {
      // Server is busy, schedule retry
      projectMessage.value = {
        type: 'error',
        text: 'Server is busy. Retrying in 15 seconds...',
      }
      isProcessing.value = false

      // Clear any existing timeout
      if (retryTimeout.value) {
        clearTimeout(retryTimeout.value)
      }

      // Schedule retry after 15 seconds
      retryTimeout.value = window.setTimeout(() => {
        handleSmallAreaProcessingRequest()
      }, 15000)
      return
    }

    if (!response.ok) {
      throw new Error(`Failed to process small area: ${response.statusText}`)
    }

    const data = await response.json()

    // Display GeoJSON if available
    if (data && data.features) {
      const extent = displayGeoJSON(data)
      // Fit map to bbox
      fitMapToBbox(extent)
    }
    removeStacLayer(props.map)
    removeStacLayer(props.map, true)
    removeExtentInteraction()

    projectMessage.value = { type: 'success', text: 'Small area processed successfully' }
  } catch (error) {
    console.error('Error processing small area:', error)
    projectMessage.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Failed to process small area',
    }
  } finally {
    isProcessing.value = false
    // Clear message after 3 seconds (only for non-retry cases)
    if (retryTimeout.value === null) {
      setTimeout(() => {
        projectMessage.value = null
      }, 3000)
    }
  }
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
          //TODO Handle results display
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

// Expose methods to parent components
defineExpose({
  getActiveTileGeometry,
})
</script>

<template>
  <div>
    <div class="accordion-header" @click="toggleAccordion">
      <h3>Processing</h3>
      <span class="accordion-icon" :class="{ open: isOpen }">▼</span>
    </div>

    <transition name="accordion">
      <div v-show="isOpen">
        <div class="mode-selector">
          <input
            type="radio"
            id="smallAreaProcessing"
            value="smallAreaProcessing"
            v-model="processingMode"
            :disabled="isProcessing || isCreatingProject"
          />
          <label for="smallAreaProcessing">Small Area Processing</label>
          <br />
          <input
            type="radio"
            id="batchProcessing"
            value="batchProcessing"
            v-model="processingMode"
            :disabled="isProcessing || isCreatingProject"
          />
          <label for="batchProcessing">Batch Processing</label>
        </div>
        <p v-if="searchStatus === ''">Select a grid cell to search for Sentinel-2 images</p>
        <div class="search-status">{{ searchStatus }}</div>

        <div v-if="isLoading" class="loading">Loading...</div>

        <div v-else-if="searchResults.length > 0" class="results-container">
          <div class="selected-tile-header">{{ currentMgrsTileId }} Results</div>

          <!-- Action buttons section -->
          <div class="action-buttons">
            <div v-if="processingMode === 'batchProcessing'" class="title-input">
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
              v-if="processingMode === 'batchProcessing'"
              class="action-button"
              :disabled="!activeTileId || !secondActiveTileId || isCreatingProject"
              @click="handleCompareTiles"
            >
              <span v-if="isCreatingProject">Creating Project...</span>
              <span v-else>Run Batch Processing</span>
            </button>
            <button
              v-if="processingMode === 'smallAreaProcessing'"
              class="action-button"
              :disabled="!activeTileId || !secondActiveTileId || isProcessing"
              @click="handleSmallAreaProcessingRequest"
            >
              <span v-if="isProcessing">Processing...</span>
              <span v-else>Run Small Area Processing</span>
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
                    @click="handleViewOnMap(result.tiffUrl, result.bounds, result?.id, false)"
                  >
                    <img :src="result.thumbnailUrl" alt="Preview" crossorigin="anonymous" />
                  </div>
                  <div class="result-header">
                    <h3>{{ result?.id }}</h3>
                  </div>
                  <div class="result-details">
                    <div>Date: {{ result.date }}</div>
                    <div>Cloud Cover: {{ result.cloudCover }}%</div>
                    <div v-if="result.areaCoverage !== undefined">
                      Area Coverage:
                      {{
                        typeof result.areaCoverage === 'number'
                          ? result.areaCoverage.toFixed(1)
                          : result.areaCoverage
                      }}%
                    </div>
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
                      crossorigin="anonymous"
                    />
                  </div>
                  <div class="result-header">
                    <h3>{{ activeTileId }}</h3>
                  </div>
                  <div class="result-details">
                    <div>Date: {{ getActiveTileDate(false) }}</div>
                    <div>Cloud Cover: {{ getActiveTileCloudCover(false) }}%</div>
                    <div v-if="getActiveTileAreaCoverage(false) !== undefined">
                      Area Coverage: {{ formatAreaCoverage(getActiveTileAreaCoverage(false)) }}%
                    </div>
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
                      @click="handleViewOnMap(result.tiffUrl, result.bounds, result?.id, true)"
                    >
                      <img :src="result.thumbnailUrl" alt="Preview" crossorigin="anonymous" />
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
.mode-selector {
  margin-bottom: 1em;
}
</style>
