<script setup lang="ts">
import { ref, onUnmounted, watch, nextTick, computed } from 'vue'
import { type Extent } from 'ol/extent'
import { generateJWT } from '../functions/generate-jwt'
import { transformExtent } from 'ol/proj'
import { useSnackbar } from '../composables/useSnackbar'
import searchStacApi from '../functions/search-stac-api'
import { SearchResult, useSearch } from '../composables/useSearch'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { FeatureCollection } from 'geojson'
import { useStacLayer } from '../composables/useStacLayer'
import { useAreaOfInterest } from '../composables/useAreaOfInterest'
import { useProcessingMode } from '../composables/useProcessingMode'
import { useMap } from '../composables/useMap'
import { mdiHelpCircleOutline } from '@mdi/js'
import { useSettings } from '../composables/useSettings'
import TilePreview from './TilePreview.vue'

const emit = defineEmits<{
  (e: 'updateGeoJSONResults', results: any[]): void
  (e: 'processingChanged', isProcessing: boolean): void
}>()

const { map, vectorLayer, handleMapClick } = useMap()
const { removeStacLayer } = useStacLayer()
const { removeExtentInteraction, removeDrawVectorLayer, drawnExtent, getTileById } =
  useAreaOfInterest()
const { showInfo, showWarning, showError, showSuccess } = useSnackbar()

const { currentBbox, hasMore, isLoading, searchResults, searchStatus, handleSearchResults } =
  useSearch()

const { currentMgrsTileId, activeTileId, secondActiveTileId } = useAreaOfInterest()

watch(drawnExtent, (newValue) => {
  if (newValue) {
    isFirstResultsOpen.value = true
  }
})

watch(activeTileId, (newValue) => {
  if (newValue && !secondActiveTileId.value) {
    isFirstResultsOpen.value = false
    isSecondResultsOpen.value = true
  }
})

const { processingMode, isBatchProcessing } = useProcessingMode()

const isCreatingProject = ref(false)
const isProcessing = ref(false)
const projectTitle = ref(new Date().toISOString())
const isFirstResultsOpen = ref(false)
const isSecondResultsOpen = ref(false)
const hasLoadedMore = ref(false)
const retryTimeout = ref<number | null>(null)

const sceneYears = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)

const { settings, autoSceneSelection, sceneYear, modelIsSingleShot } = useSettings()

let abortController: AbortController | null = null
watch([drawnExtent, sceneYear, settings], async ([newExtent, newYear]) => {
  if (!autoSceneSelection.value || !newExtent || !newYear) {
    return
  }

  // Auto scene selection is enabled, perform search
  try {
    // Abort previous fetch if exists
    if (abortController) {
      abortController.abort('obsolete request')
    }

    // Create new AbortController for this fetch
    abortController = new AbortController()

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}scene-selection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${generateJWT()}`,
      },
      body: JSON.stringify({
        bbox: transformExtent(newExtent, 'EPSG:3857', 'EPSG:4326'),
        year: newYear,
        cloud_cover_max: settings.value.cloudCover,
      }),
      signal: abortController.signal,
    })
    abortController = null // Clear abortController on successful fetch
    const data = await response.json()
    if (response.status !== 200) {
      throw new Error(data.detail || 'Scene selection failed')
    }
    // Expecting data to have window_a and window_b properties with STAC item URLs:
    // const data = {
    //   window_a:
    //     'https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/S2B_T34UEA_20250319T094246_L2A',
    //   window_b:
    //     'https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/S2C_T34UEA_20250920T094522_L2A',
    // }
    const { window_a: windowA, window_b: windowB } = data
    activeTileId.value = new URL(windowA).pathname.split('/').pop() || null
    if (activeTileId.value) {
      isFirstResultsOpen.value = false
    }
    secondActiveTileId.value = new URL(windowB).pathname.split('/').pop() || null
    if (secondActiveTileId.value) {
      isSecondResultsOpen.value = false
    }
  } catch (error) {
    if (error !== 'obsolete request') {
      console.error('Error during auto scene selection:', error)
      showError(
        'Failed to perform auto scene selection: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
    }
  }
})

const firstTile = ref<SearchResult | null>(null)
const secondTile = ref<SearchResult | null>(null)
watch(activeTileId, async (id) => {
  firstTile.value = id ? await getTileById(id) : null
})
watch(secondActiveTileId, async (id) => {
  secondTile.value = id ? await getTileById(id) : null
})

watch([isProcessing, isCreatingProject], () => {
  emit('processingChanged', isProcessing.value || isCreatingProject.value)
})

const toggleFirstResults = () => {
  isFirstResultsOpen.value = !isFirstResultsOpen.value
}

const toggleSecondResults = () => {
  isSecondResultsOpen.value = !isSecondResultsOpen.value
}

// Function to load more results
const loadMore = async () => {
  isLoading.value = true
  let firstNewItemId: string | null = null

  try {
    const response = await searchStacApi(currentBbox.value, false, settings.value)
    if (response) {
      // Store the first item ID before adding results
      firstNewItemId = response.results.length > 0 ? response.results[0].id : null

      // Accumulate results instead of overwriting them
      searchResults.value = [...searchResults.value, ...response.results]
      hasMore.value = response.hasMore
      hasLoadedMore.value = true // Mark that loadMore has been called

      if (response.results.length === 0) {
        searchStatus.value = `No more images found. Try adjusting your filters (date range, cloud cover, area coverage) to increase the likelihood of finding more results.`
      } else {
        searchStatus.value = `Loaded ${response.results.length} more images (${searchResults.value.length} total)`
      }
    }
  } catch (error: unknown) {
    console.error('Error loading more results:', error)
    searchStatus.value = `Error loading more results: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`
  } finally {
    isLoading.value = false

    // Scroll to the first new item after loading is complete
    if (firstNewItemId) {
      // Use nextTick to ensure DOM is fully updated after loading state ends
      await nextTick()

      // Retry mechanism in case the element isn't immediately available
      const scrollToElement = async (retries = 3) => {
        const element = document.getElementById(firstNewItemId!)
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest',
          })
        } else if (retries > 0) {
          // If element not found, wait a bit and retry
          setTimeout(() => scrollToElement(retries - 1), 100)
        }
      }

      await scrollToElement()
    }
  }
}

// Function to reset to original search results
const resetToOriginalSearch = async () => {
  if (!currentBbox.value) return

  // Use the existing handleSearchResults function to reset to original search
  await handleSearchResults(currentMgrsTileId.value, currentBbox.value, settings.value)
  hasLoadedMore.value = false // Reset the flag
}

const fitMapToBbox = (bbox: number[]) => {
  // Validate bbox before processing
  if (!bbox || bbox.length !== 4 || bbox.some((coord) => isNaN(coord) || coord === 0)) {
    console.warn('Invalid bbox provided to fitMapToBbox:', bbox)
    return
  }

  const extent: Extent = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857')

  // Validate transformed extent
  if (!extent || extent.some((coord) => isNaN(coord))) {
    console.warn('Invalid transformed extent:', extent)
    return
  }

  // TODO: FIX ISSUE WITH SCROLLING AND CHANGE LAYER COLOR
  map.value?.getView().fit(extent, {
    padding: [50, 50, 50, 50],
    duration: 500,
  })
}

const displayGeoJSON = (geojson: FeatureCollection & { crs: { properties: { name: string } } }) => {
  // Remove existing vector layer if it exists
  if (vectorLayer.value) {
    map.value?.removeLayer(vectorLayer.value)
  }

  // Create new vector source and layer
  const source = new VectorSource({
    features: new GeoJSON({
      dataProjection: geojson.crs.properties.name,
      featureProjection: 'EPSG:3857',
    }).readFeatures(geojson),
  })

  // Check if we have valid features
  if (source.getFeatures().length === 0) {
    showWarning(
      'No valid features found in the processing results. Please try again with a different area or settings.'
    )
    return null
  }

  vectorLayer.value = new VectorLayer({
    source: source,
    style: {
      'fill-color': 'rgba(255, 255, 0, 0.1)',
      'stroke-color': 'rgba(255, 255, 0, 1)',
      'stroke-width': 2,
    },
    zIndex: 1001, // Higher than S2-grid-layer (1000)
  })

  // Ensure the results layer is on top by setting a high z-index
  map.value?.addLayer(vectorLayer.value)

  // Emit the GeoJSON results to the parent component
  const results = source.getFeatures().map((feature) => ({
    id: feature.getId() || `feature-${Date.now()}-${Math.random()}`,
    geometry: feature.getGeometry(),
    properties: feature.getProperties(),
  }))
  emit('updateGeoJSONResults', results)

  // Add map click handler to detect feature clicks and show properties
  map.value?.on('click', handleMapClick)

  // Get the extent and validate it
  const extent = source.getExtent()
  if (!extent || extent.every((coord) => coord === 0) || extent.some((coord) => isNaN(coord))) {
    showWarning(
      'Invalid extent generated from processing results. Please try again with a different area or settings.'
    )
    return null
  }

  return transformExtent(extent, 'EPSG:3857', 'EPSG:4326')
}

const handleSmallAreaProcessingRequest = async () => {
  if (!drawnExtent.value) {
    showWarning('Please draw an extent on the map before processing.')
    return
  }

  if (!firstTile.value || (!modelIsSingleShot.value && !secondTile.value)) {
    throw new Error('Could not find selected tiles')
  }

  isProcessing.value = true
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
          model: settings.value.selectedModel,
          images: modelIsSingleShot.value
            ? [firstTile.value.itemUrl]
            : [firstTile.value.itemUrl, secondTile.value?.itemUrl],
          bbox: transformExtent(drawnExtent.value, 'EPSG:3857', 'EPSG:4326'),
        },
        polygons: {
          close_interiors: true,
        },
      }),
    })

    if (response.status === 503) {
      // Server is busy, schedule retry
      showInfo('Server is busy. Retrying in 15 seconds...', 15)
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

    const data = await response.json()

    if (!response.ok) {
      const error = data?.detail || response.statusText
      throw new Error(`Failed to process: ${error}`)
    }

    // Display GeoJSON if available
    if (data && data.features && Array.isArray(data.features) && data.features.length > 0) {
      const extent = displayGeoJSON(data)
      // Fit map to bbox only if we have a valid extent
      if (extent) {
        fitMapToBbox(extent)
        showSuccess('Finished processing, results will be shown on the map.')
        // Remove the editable bbox since we have results
        removeDrawVectorLayer(map.value!)
      } else {
        // displayGeoJSON returned null, which means no valid features or invalid extent
        showWarning(
          'Processing completed but the extent of the results is empty. Please try again with a different settings.'
        )
      }
    } else {
      showWarning(
        'Processing completed but no valid results were generated. Please try again with a different settings.'
      )
    }

    removeStacLayer(map.value!)
    removeStacLayer(map.value!, true)
    removeExtentInteraction()
  } catch (error) {
    console.error('Error processing:', error)
    showError(
      'Failed to process: ' + (error instanceof Error ? error.message : 'An unknown error occured')
    )
  } finally {
    isProcessing.value = false
  }
}

const handleCompareTiles = async () => {
  if (!firstTile.value || (!modelIsSingleShot.value && !secondTile.value)) {
    throw new Error('Could not find selected tiles')
  }

  isCreatingProject.value = true

  try {
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
      showInfo('Server is busy. Retrying in 15 seconds...', 15)
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

    const projectData = await createResponse.json()
    if (!createResponse.ok) {
      const error = projectData?.detail || createResponse.statusText
      isCreatingProject.value = false
      throw new Error(`Failed to create project: ${error}`)
    }

    const projectId = projectData.id

    isCreatingProject.value = false
    isProcessing.value = true

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
        model: settings.value.selectedModel,
        bbox: transformExtent(drawnExtent.value, 'EPSG:3857', 'EPSG:4326'),
        images: modelIsSingleShot.value
          ? [firstTile.value.itemUrl]
          : [firstTile.value.itemUrl, secondTile.value?.itemUrl],
      }),
    })

    if (batchProcessingResponse.status === 503) {
      // Server is busy, schedule retry
      showInfo('Server is busy. Retrying in 15 seconds...', 15)
      isProcessing.value = false

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
          if (!projectStatus.results.polygons) {
            // Create polygonize task
            const polygonsResponse = await fetch(`${apiBaseUrl}projects/${projectId}/polygons`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                close_interiors: true,
              }),
            })
            if (!polygonsResponse.ok) {
              throw new Error(`Failed to process polygons: ${polygonsResponse.statusText}`)
            }
            return
          }
          clearInterval(pollInterval)

          // Fetch batch processing results
          const resultPolygons = projectStatus.results.polygons
          const url = resultPolygons.startsWith('http')
            ? resultPolygons
            : `${import.meta.env.VITE_FTW_INFERENCE_OUTPUT_URL || ''}${resultPolygons}`
          const resultsResponse = await fetch(url, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          })
          if (!resultsResponse.ok) {
            throw new Error(
              `Failed to fetch batch processing results: ${resultsResponse.statusText}`
            )
          }

          const data = await resultsResponse.json()

          // Display GeoJSON if available
          if (data && data.features) {
            const extent = displayGeoJSON(data)
            // Fit map to bbox
            if (extent) {
              fitMapToBbox(extent)
            }
          }
          removeStacLayer(map.value!)
          removeStacLayer(map.value!, true)
          removeExtentInteraction()

          isProcessing.value = false
          showSuccess('Finished batch processing, results will be shown on the map.')
          // Remove the editable bbox since batch processing completed successfully
          removeDrawVectorLayer(map.value!)
        } else if (projectStatus.status === 'failed') {
          clearInterval(pollInterval)
          showError('Batch processing failed')
          throw new Error('Batch processing failed')
        }
      } catch (error) {
        clearInterval(pollInterval)
        isProcessing.value = false
        throw error
      } finally {
        isCreatingProject.value = false
        isProcessing.value = false
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
    showError(error instanceof Error ? error.message : 'Failed to create project or upload images')
  } finally {
    isCreatingProject.value = false
    // Clear message after 3 seconds (only for non-retry cases)
  }
}

// Clean up map click handler when component is unmounted
onUnmounted(() => {
  if (map.value) {
    map.value.un('click', handleMapClick)
  }
})
</script>

<template>
  <div class="settings">
    <v-alert density="compact" :type="isBatchProcessing ? 'warning' : 'info'" class="mb-2">
      <template v-if="isBatchProcessing">
        You are in <strong>batch mode</strong> due to the selected larger area. The processing may
        take multiple minutes depending on the selected settings.
      </template>
      <template v-else>
        You are in <strong>small area mode</strong>. The processing usually takes less than 30
        seconds. Use this for a quick preview on smaller areas.
      </template>
    </v-alert>

    <div v-if="searchStatus" class="search-status">{{ searchStatus }}</div>

    <div v-if="searchResults.length > 0" class="results-container">
      <v-checkbox v-model="autoSceneSelection" density="compact" hide-details
        ><template v-slot:label
          >Automatic Scene Selection
          <v-tooltip max-width="400" open-on-click>
            <template #activator="{ props }">
              <v-icon
                class="ml-1"
                :icon="mdiHelpCircleOutline"
                size="x-small"
                v-bind="props"
              ></v-icon>
            </template>
            <div>
              When checked, a suitable scene will be automatically chosen based on the selected year
              and the crop calendar for the selected area. When not checked, two scenes have to be
              selected manually - one for the time around planting and one for the time around
              harvest.
            </div>
          </v-tooltip>
        </template>
      </v-checkbox>
      <v-select
        v-if="autoSceneSelection"
        class="pt-2 pb-2"
        type="number"
        v-model.number="sceneYear"
        :items="sceneYears"
        label="Select scene year"
        density="compact"
        hide-details
        variant="outlined"
      />
      <div class="accordion-header" @click="toggleFirstResults">
        <h3 class="window-header">
          {{ activeTileId ? firstTile?.date || activeTileId : 'Select Win A' }}
        </h3>
        <span class="accordion-icon" :class="{ open: isFirstResultsOpen }">▼</span>
      </div>

      <transition name="accordion">
        <div v-show="isFirstResultsOpen">
          <!-- Show second accordion's active tile first -->
          <TilePreview v-if="activeTileId" :tileId="activeTileId" win="a" />
          <!-- Show other results -->
          <TilePreview
            v-for="result in searchResults.filter(
              (r) => r.id !== activeTileId && r.id !== secondActiveTileId
            )"
            :key="result?.id"
            win="a"
            :tileId="result?.id"
          />
          <div v-if="!hasMore">
            No more images found. Try adjusting your filters (date range, cloud cover, area
            coverage) to increase the likelihood of finding more results.
          </div>
          <div class="button-group">
            <button v-if="hasMore" @click="loadMore" class="load-more-button" :disabled="isLoading">
              <template v-if="isLoading">Loading...</template>
              <template v-else>Load More</template>
            </button>
            <button
              v-if="hasLoadedMore"
              @click="resetToOriginalSearch"
              class="reset-button"
              :disabled="isLoading"
            >
              Reset
            </button>
          </div>
        </div>
      </transition>

      <!-- Second Accordion for Selected Results -->
      <div
        v-if="modelIsSingleShot === false"
        class="selected-results-section"
        :class="{ disabled: !activeTileId }"
      >
        <div
          class="accordion-header"
          @click="toggleSecondResults"
          :class="{ disabled: !activeTileId }"
        >
          <h3 class="window-header">
            {{ secondActiveTileId ? secondTile?.date || secondActiveTileId : 'Select Win B' }}
          </h3>
          <span class="accordion-icon" :class="{ open: isSecondResultsOpen }">▼</span>
        </div>

        <transition name="accordion">
          <div v-show="isSecondResultsOpen && activeTileId" class="results">
            <!-- Show second accordion's active tile first -->
            <TilePreview v-if="secondActiveTileId" :tileId="secondActiveTileId" win="b" />
            <!-- Show other results -->
            <TilePreview
              v-for="result in searchResults.filter(
                (r) => r.id !== activeTileId && r.id !== secondActiveTileId
              )"
              :key="result?.id"
              win="b"
              :tileId="result?.id"
            />

            <div class="button-group">
              <button
                v-if="hasMore"
                @click="loadMore"
                class="load-more-button"
                :disabled="isLoading"
              >
                Load More
              </button>
              <button
                v-if="hasLoadedMore"
                @click="resetToOriginalSearch"
                class="reset-button"
                :disabled="isLoading"
              >
                Reset
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>

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
    <button
      v-if="processingMode === 'batchProcessing'"
      class="action-button"
      :disabled="!activeTileId || (!modelIsSingleShot && !secondActiveTileId) || isCreatingProject"
      @click="handleCompareTiles"
    >
      <span v-if="isCreatingProject || isProcessing"
        ><v-progress-circular indeterminate size="16" width="2" class="me-1" />
        <template v-if="isCreatingProject">Creating Project...</template>
        <template v-else>Processing...</template>
      </span>
      <span v-else>Create project and start processing</span>
    </button>
    <button
      v-if="processingMode === 'smallAreaProcessing'"
      class="action-button"
      :disabled="!activeTileId || (!modelIsSingleShot && !secondActiveTileId) || isProcessing"
      @click="handleSmallAreaProcessingRequest"
    >
      <span v-if="isProcessing"
        ><v-progress-circular indeterminate size="16" width="2" class="me-1" /> Processing...</span
      >
      <span v-else>Start processing</span>
    </button>
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
}

.results-container {
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
  min-height: 300px;
  max-height: 50vh;
}

.settings {
  flex: 1;
  padding: 0.5rem 1rem;
  overflow-y: auto;
  min-height: min-content;
}

.action-buttons {
  flex: 0;
  padding: 0.5rem 1rem;
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

.load-more-button {
  background-color: rgba(0, 136, 136, 0.8);
  color: white;
  border: none;
  padding: 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  flex: 1;
  font-size: 0.875rem;
}

.load-more-button:hover {
  background-color: rgba(0, 136, 136, 1);
}

.load-more-button:disabled {
  background-color: rgba(0, 136, 136, 0.4);
  cursor: not-allowed;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.reset-button {
  background-color: rgba(255, 165, 0, 0.8);
  color: white;
  border: none;
  padding: 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  flex: 1;
  font-size: 0.875rem;
}

.reset-button:hover {
  background-color: rgba(255, 165, 0, 1);
}

.reset-button:disabled {
  background-color: rgba(255, 165, 0, 0.4);
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

.window-header {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
