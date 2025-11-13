<script setup lang="ts">
import { ref, onUnmounted, watch, nextTick, computed, onMounted } from 'vue'
import { type Extent } from 'ol/extent'
import { generateJWT } from '../functions/generate-jwt'
import { transformExtent } from 'ol/proj'
import searchStacApi from '../functions/search-stac-api'
import useSearch, { type SearchResult } from '../composables/useSearch'
import { fromExtent } from 'ol/geom/Polygon'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { type FeatureCollection } from 'geojson'
import useSettings from '../composables/useSettings'
import useNotifier from '../composables/useNotifier'
import useStacLayer from '../composables/useStacLayer'
import useAreaOfInterest from '../composables/useAreaOfInterest'
import useProcessingMode from '../composables/useProcessingMode'
import useMap from '../composables/useMap'
import { mdiHelpCircleOutline } from '@mdi/js'
import TilePreview from './TilePreview.vue'

const emit = defineEmits<{
  (e: 'updateGeoJSONResults', results: any[]): void
  (e: 'workStateChanged', isWorking: boolean): void
}>()

const { map, vectorLayer, handleMapClick, areaValues } = useMap()
const { removeStacLayer } = useStacLayer()
const {
  calculateArea,
  removeExtentInteraction,
  removeDrawVectorLayer,
  drawnExtent,
  getTileById,
  triggerTileSelection,
} = useAreaOfInterest()
const { showInfo, showWarning, showError, showSuccess } = useNotifier()
const { isBatchProcessing, updateProcessingMode } = useProcessingMode()
const { currentBbox, hasMore, isLoading, searchResults, searchStatus, handleSearchResults } =
  useSearch()
const { activeTileId, secondActiveTileId, currentMgrsTileId } = useAreaOfInterest()
const { settings, collections, availableCollections, availableModels, modelIsSingleShot } =
  useSettings()

const months = [
  { value: 1, title: '1 - January' },
  { value: 2, title: '2 - February' },
  { value: 3, title: '3 - March' },
  { value: 4, title: '4 - April' },
  { value: 5, title: '5 - May' },
  { value: 6, title: '6 - June' },
  { value: 7, title: '7 - July' },
  { value: 8, title: '8 - August' },
  { value: 9, title: '9 - September' },
  { value: 10, title: '10 - October' },
  { value: 11, title: '11 - November' },
  { value: 12, title: '12 - December' },
]

watch(drawnExtent, (newValue) => {
  if (activePanel.value !== 'location' && !settings.value.autoSceneSelection && newValue) {
    activePanel.value = 'win-a'
  }
})

watch(activeTileId, (newValue) => {
  if (!newValue) {
    activePanel.value = 'win-a'
  } else if (!secondActiveTileId.value) {
    activePanel.value = 'win-b'
  }
})

const isCreatingProject = ref(false)
const isProcessing = ref(false)
const projectTitle = ref(new Date().toISOString())
const activePanel = ref<string | null>(null)
const hasLoadedMore = ref(false)
const retryTimeout = ref<number | null>(null)
const sceneSelectionStatus = ref<boolean | null>(null)
const sceneYears = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)

const isSelectingScenes = computed(
  () => sceneSelectionStatus.value === null && settings.value.autoSceneSelection
)

let abortController: AbortController | null = null
watch([drawnExtent, settings], async ([newExtent, newSettings]) => {
  if (!newSettings.autoSceneSelection || !newExtent || !newSettings.year) {
    return
  }

  sceneSelectionStatus.value = null

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
        year: newSettings.year,
        cloud_cover_max: newSettings.cloudCover,
      }),
      signal: abortController.signal,
    })
    abortController = null // Clear abortController on successful fetch
    const data = await response.json()
    if (response.status !== 200) {
      if (data.detail) {
        sceneSelectionStatus.value = false
        showError(data.detail)
        return
      }
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
    secondActiveTileId.value = new URL(windowB).pathname.split('/').pop() || null

    sceneSelectionStatus.value = true
  } catch (error) {
    if (error !== 'obsolete request') {
      sceneSelectionStatus.value = false
      console.error('Error during auto scene selection:', error)
      showError(
        'Failed to perform auto scene selection: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
    }
  }
})

// todo: check whether we should only run on a subset of settings
watch(
  [settings, currentBbox],
  () => {
    // If there's an active search area, refresh the search with new settings
    if (currentBbox.value && currentMgrsTileId.value) {
      // Trigger a new search with the updated settings
      handleSearchResults(currentBbox.value, settings.value)
    }
  },
  { deep: true }
)

const availableTiles = ref<any[]>([])

// Load available S2 tiles from the map layer
const loadAvailableTiles = () => {
  if (!map.value) {
    return
  }

  const layers = map.value.getLayers().getArray()

  const s2GridLayer = layers.find(
    (layer) =>
      layer.get('name') === 's2-grid' ||
      (layer.get('properties') && layer.get('properties').name === 's2-grid') ||
      ((layer as any).getSource && (layer as any).getSource().getFeatures)
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

// Bounding box selection
const bbox = ref<number[]>(currentBbox.value || [-180.0, -90.0, 180.0, 90.0])

const bboxValid = computed(() => {
  if (bbox.value.length !== 4) {
    return false
  }
  const [minX, minY, maxX, maxY] = bbox.value
  return (
    typeof minX === 'number' &&
    typeof minY === 'number' &&
    typeof maxX === 'number' &&
    typeof maxY === 'number' &&
    minX >= -180 &&
    maxX <= 180 &&
    minY >= -90 &&
    maxY <= 90 &&
    minX < maxX &&
    minY < maxY
  )
})

watch(bboxValid, (newValue) => {
  if (newValue) {
    const transformedBbox = transformExtent(bbox.value, 'EPSG:4326', 'EPSG:3857')
    handleBboxSelected(transformedBbox)
  }
})

const updateBBox = (index: number, value: number) => {
  const newBbox = [...bbox.value]
  newBbox[index] = value
  bbox.value = newBbox
}

const syncBBox = (newValue?: number[]) => {
  // todo: Sync doesn't work properly when only chancing in a single tile
  if (Array.isArray(newValue)) {
    bbox.value = transformExtent(newValue, 'EPSG:3857', 'EPSG:4326')
  }
}

watch(currentBbox, syncBBox, { immediate: true, deep: 1 })

onMounted(() => {
  loadAvailableTiles()
  syncBBox(currentBbox.value)
})

// Window A and B input fields
const firstTile = ref<SearchResult | null>(null)
const secondTile = ref<SearchResult | null>(null)
watch(activeTileId, async (id) => {
  firstTile.value = id ? await getTileById(id) : null
})
watch(secondActiveTileId, async (id) => {
  secondTile.value = id ? await getTileById(id) : null
})
watch([isProcessing, isCreatingProject, isSelectingScenes], () => {
  emit('workStateChanged', isProcessing.value || isCreatingProject.value || isSelectingScenes.value)
})
watch(sceneSelectionStatus, (newValue) => {
  if (newValue === false) {
    activeTileId.value = null
    secondActiveTileId.value = null
  }
})

const collectionTitle = computed(() => {
  const collection = settings.value.collection[0]
  return collection ? collections[collection] : null
})

const modelTitle = computed(() => {
  const model = settings.value.model
  return model ? availableModels.value.find((m) => m.id === model)?.title || null : null
})

const filteredResults = computed(() => {
  if (!Array.isArray(searchResults.value)) {
    return []
  }
  return searchResults.value.filter(
    (r) => r.id !== activeTileId.value && r.id !== secondActiveTileId.value
  )
})

const sortAsc = (a: SearchResult, b: SearchResult) => {
  return (a.isoDate || a.id).localeCompare(b.isoDate || b.id)
}
const sortDesc = (a: SearchResult, b: SearchResult) => {
  return (b.isoDate || b.id).localeCompare(a.isoDate || a.id)
}

const resultsA = computed(() => {
  return filteredResults.value.sort(sortAsc)
})
const resultsB = computed(() => {
  return filteredResults.value.sort(sortDesc)
})

// Function to load more results
const loadMore = async () => {
  isLoading.value = true
  let firstNewItemId: string | null = null

  searchStatus.value = true
  try {
    const response = await searchStacApi(currentBbox.value, false, settings.value)
    if (response) {
      // Store the first item ID before adding results
      firstNewItemId = response.results.length > 0 ? response.results[0].id : null

      // Accumulate results instead of overwriting them
      searchResults.value = [...searchResults.value, ...response.results]
      hasMore.value = response.hasMore
      hasLoadedMore.value = true // Mark that loadMore has been called

      searchStatus.value = searchResults.value.length
    }
  } catch (error: unknown) {
    console.error('Error loading more results:', error)
    showError(
      `Error loading more results: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    searchStatus.value = false
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

const updateCloudCoverInput = () => {
  // Ensure the value is a number and not below 1
  const value = Number(settings.value.cloudCover)
  settings.value.cloudCover = Math.max(1, value)
}

const updateCloudCoverSlider = () => {
  // Ensure the value is a number and not below 1
  const value = Number(settings.value.cloudCover)
  settings.value.cloudCover = Math.max(1, value)
}

const updateAreaCoverageInput = () => {
  // Ensure the value is a number and not below 1
  const value = Number(settings.value.areaCoverage)
  settings.value.areaCoverage = Math.max(1, value)
}

const updateAreaCoverageSlider = () => {
  // Ensure the value is a number and not below 1
  const value = Number(settings.value.areaCoverage)
  settings.value.areaCoverage = Math.max(1, value)
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
  map.value!.getView().fit(extent, {
    padding: [50, 50, 50, 50],
    duration: 500,
  })
}

const displayGeoJSON = (geojson: FeatureCollection & { crs: { properties: { name: string } } }) => {
  // Remove existing vector layer if it exists
  if (vectorLayer.value) {
    map.value!.removeLayer(vectorLayer.value)
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
  map.value!.addLayer(vectorLayer.value)

  // Emit the GeoJSON results to the parent component
  const results = source.getFeatures().map((feature) => ({
    id: feature.getId() || `feature-${Date.now()}-${Math.random()}`,
    geometry: feature.getGeometry(),
    properties: feature.getProperties(),
  }))
  emit('updateGeoJSONResults', results)

  // Add map click handler to detect feature clicks and show properties
  map.value!.on('click', handleMapClick)

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
          model: settings.value.model,
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
      showInfo('Server is busy. Retrying in 15 seconds...')
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

// Handle tile selection from search modal
const handleTileSelected = (tileName: string) => {
  // Find the tile feature on the map and trigger the tile selection
  const layers = map.value!.getLayers().getArray()
  const s2GridLayer = layers.find(
    (layer) =>
      layer.get('name') === 's2-grid' ||
      (layer.get('properties') && layer.get('properties').name === 's2-grid') ||
      ((layer as any).getSource && (layer as any).getSource().getFeatures)
  )

  if (s2GridLayer && (s2GridLayer as any).getSource) {
    const features = (s2GridLayer as any).getSource().getFeatures()
    const targetFeature = features.find((f: any) => f.get('Name') === tileName)

    if (targetFeature) {
      triggerTileSelection(map.value!, tileName, areaValues.value!, handleSearchResults)
    }
  }
}

const handleBboxSelected = (bbox: number[]) => {
  // Set the drawn extent for the area of interest
  drawnExtent.value = bbox

  const geometry = fromExtent(bbox)
  const area = calculateArea(geometry)
  updateProcessingMode(area, areaValues.value)

  // Trigger the search with the custom bbox
  handleSearchResults(bbox, settings.value)
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
      showInfo('Server is busy. Retrying in 15 seconds...')
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
        model: settings.value.model,
        bbox: transformExtent(drawnExtent.value, 'EPSG:3857', 'EPSG:4326'),
        images: modelIsSingleShot.value
          ? [firstTile.value.itemUrl]
          : [firstTile.value.itemUrl, secondTile.value?.itemUrl],
      }),
    })

    if (batchProcessingResponse.status === 503) {
      // Server is busy, schedule retry
      showInfo('Server is busy. Retrying in 15 seconds...')
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
    <v-alert
      density="compact"
      :type="isBatchProcessing ? 'warning' : 'info'"
      :color="isBatchProcessing ? 'warning' : 'gray'"
      class="mb-2"
    >
      <template v-if="isBatchProcessing">
        You are in <strong>batch mode</strong> due to the selected larger area. The processing may
        take multiple minutes depending on the selected settings.
      </template>
      <template v-else>
        You are in <strong>small area mode</strong>. The processing usually takes less than 30
        seconds. Use this for a quick preview on smaller areas.
      </template>
    </v-alert>

    <v-row>
      <v-col class="d-flex justify-end">
        <v-switch
          v-model="settings.expertMode"
          label="Expert Mode"
          density="compact"
          hide-details
          class
        ></v-switch>
      </v-col>
    </v-row>

    <v-expansion-panels v-model="activePanel">
      <v-expansion-panel v-if="isBatchProcessing" value="project">
        <v-expansion-panel-title>
          <span class="header-text">
            Project
            <v-badge inline color="teal" :content="projectTitle"></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-text-field
            v-model="projectTitle"
            label="Title"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Model -->
      <v-expansion-panel value="model">
        <v-expansion-panel-title>
          <span class="header-text">
            Model
            <v-badge v-if="modelTitle" inline color="teal" :content="modelTitle"></v-badge>
            <v-badge v-else inline color="error" content="Missing"></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-radio-group v-model="settings.model" inline hide-details>
            <v-radio v-for="model in availableModels" :key="model.id" :value="model.id" color="teal"
              ><template v-slot:label>
                {{ model.title }}
                <v-badge
                  inline
                  color="black"
                  v-if="model.version"
                  title="Version"
                  :content="model.version"
                ></v-badge>
                <v-tooltip v-if="model.description" max-width="400" open-on-click>
                  <template #activator="{ props }">
                    <v-icon
                      class="ml-1"
                      :icon="mdiHelpCircleOutline"
                      size="x-small"
                      v-bind="props"
                    ></v-icon>
                  </template>
                  <div>
                    <strong>License:</strong> {{ model.license || 'unknown' }}<br />
                    <template v-if="model.description">
                      <strong>Description:</strong>
                      <div style="white-space: pre-wrap">
                        {{ model.description }}
                      </div>
                    </template>
                  </div>
                </v-tooltip></template
              ></v-radio
            >
          </v-radio-group>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Data Collection -->
      <v-expansion-panel v-if="settings.expertMode" value="data">
        <v-expansion-panel-title>
          <span class="header-text">
            Imagery
            <v-badge
              v-if="collectionTitle"
              inline
              color="teal"
              :content="collectionTitle"
            ></v-badge>
            <v-badge v-else inline color="error" content="Missing"></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-radio-group v-model="settings.collection" inline hide-details>
            <v-radio
              v-for="collection in availableCollections"
              :key="collection[0]"
              :label="collections[collection[0]]"
              :value="collection"
              color="teal"
            />
          </v-radio-group>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Location -->
      <v-expansion-panel v-if="settings.expertMode" value="location">
        <v-expansion-panel-title>
          <span class="header-text">
            Location
            <v-badge
              v-if="currentMgrsTileId"
              inline
              color="teal"
              :content="currentMgrsTileId"
            ></v-badge>
            <v-badge v-else inline color="error" content="Missing"></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <!-- S2 Grid Selection Dropdown -->
          <v-row>
            <v-col>
              <v-autocomplete
                v-model="currentMgrsTileId"
                @update:model-value="handleTileSelected"
                label="S2 Grid Selection"
                hide-details
                dense
                variant="outlined"
                :items="availableTiles"
                item-title="name"
                item-value="name"
              ></v-autocomplete>
            </v-col>
          </v-row>

          <!-- Bbox Input Section -->
          <v-row>
            <v-col>
              <v-label>
                Bounding Box
                <v-badge v-if="bboxValid" inline color="success" content="OK"></v-badge>
                <v-badge v-else inline color="error" content="Invalid"></v-badge>
              </v-label>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="3"> </v-col>
            <v-col cols="6">
              <v-number-input
                :model-value="bbox[3]"
                @update:model-value="(value) => updateBBox(3, value)"
                label="max. Latitude"
                :min="-180.0"
                :max="180.0"
                :step="0.0001"
                :precision="4"
                density="compact"
                variant="outlined"
                control-variant="stacked"
                hide-details
              ></v-number-input>
            </v-col>
            <v-col cols="3"> </v-col>
          </v-row>
          <v-row>
            <v-col cols="5">
              <v-number-input
                :model-value="bbox[0]"
                @update:model-value="(value) => updateBBox(0, value)"
                label="min. Longitude"
                :min="-180.0"
                :max="180.0"
                :step="0.0001"
                :precision="4"
                density="compact"
                variant="outlined"
                control-variant="stacked"
                hide-details
              ></v-number-input
            ></v-col>
            <v-col cols="2"> </v-col>
            <v-col cols="5">
              <v-number-input
                :model-value="bbox[2]"
                @update:model-value="(value) => updateBBox(2, value)"
                label="max. Longitude"
                :min="-180.0"
                :max="180.0"
                :step="0.0001"
                :precision="4"
                density="compact"
                variant="outlined"
                control-variant="stacked"
                hide-details
              ></v-number-input
            ></v-col>
          </v-row>
          <v-row>
            <v-col cols="3"> </v-col>
            <v-col cols="6">
              <v-number-input
                :model-value="bbox[1]"
                @update:model-value="(value) => updateBBox(1, value)"
                label="min. Latitude"
                :min="-180.0"
                :max="180.0"
                :step="0.0001"
                :precision="4"
                density="compact"
                variant="outlined"
                control-variant="stacked"
                hide-details
              ></v-number-input>
            </v-col>
            <v-col cols="3"></v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Time -->
      <v-expansion-panel value="time">
        <v-expansion-panel-title>
          <span class="header-text">
            Time
            <v-badge v-if="settings.year" inline color="teal" :content="settings.year"></v-badge>
            <v-badge v-else inline color="error" content="Missing"></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-row>
            <v-col>
              <v-select
                type="number"
                v-model.number="settings.year"
                :items="sceneYears"
                label="Year of planting"
                hide-details
                variant="outlined"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="6">
              <v-select
                v-model="settings.startMonth"
                :items="months"
                label=" Start Month"
                variant="outlined"
                density="compact"
                hide-details
                :disabled="settings.autoSceneSelection"
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="settings.endMonth"
                :items="months"
                label="End Month"
                variant="outlined"
                density="compact"
                hide-details
                :disabled="settings.autoSceneSelection"
              />
            </v-col>
          </v-row>
          <v-row>
            <v-col>
              <v-alert color="gray" type="info" variant="tonal" density="compact">
                Select a year for the scene selection. Automatic scene selection will automatically
                choose start and end dates based on crop calendars. Thus, start and end date
                selection will only be available for manual scene selection.
                <v-btn
                  @click="settings.autoSceneSelection = !settings.autoSceneSelection"
                  size="small"
                  class="mt-2"
                >
                  <template v-if="settings.autoSceneSelection">Disable</template>
                  <template v-else>Enable</template>
                  automatic scene selection
                </v-btn>
              </v-alert>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Coverage -->
      <v-expansion-panel v-if="settings.expertMode" value="coverage">
        <v-expansion-panel-title>
          <span class="header-text">
            Coverage
            <v-badge inline color="blue" :content="`Cloud ${settings.cloudCover}%`"></v-badge>
            <v-badge
              v-if="!settings.autoSceneSelection"
              inline
              color="brown"
              :content="`Area ${settings.areaCoverage}%`"
            ></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <!-- Cloud Coverage -->
          <v-row>
            <v-col cols="6">
              <v-label class="text-subtitle-2">Cloud Cover (%)</v-label>
            </v-col>
            <v-col cols="6" class="d-flex justify-end">
              <v-number-input
                v-model="settings.cloudCover"
                @update:model-value="updateCloudCoverInput"
                :min="1"
                :max="100"
                :step="1"
                :precision="0"
                density="compact"
                variant="outlined"
                control-variant="stacked"
                hide-details
                class="coverage-input"
              ></v-number-input>
            </v-col>
          </v-row>
          <v-row>
            <v-col>
              <v-slider
                v-model="settings.cloudCover"
                min="1"
                max="100"
                step="1"
                color="teal"
                track-color="grey-darken-2"
                thumb-color="teal"
                hide-details
                @update:model-value="updateCloudCoverSlider"
              />
            </v-col>
          </v-row>
          <v-row>
            <v-col>
              <v-alert
                v-if="settings.cloudCover > 50"
                type="warning"
                variant="tonal"
                density="compact"
              >
                Cloud cover above 50% may decrease the probability of getting accurate results. Try
                to select an area without clouds.
              </v-alert>
            </v-col>
          </v-row>
          <!-- Area Coverage -->
          <v-row>
            <v-col cols="6">
              <v-label class="text-subtitle-2">Area Coverage (%)</v-label>
            </v-col>

            <v-col cols="6" class="d-flex justify-end">
              <v-number-input
                v-model="settings.areaCoverage"
                @update:model-value="updateAreaCoverageInput"
                :min="0"
                :max="100"
                :step="1"
                :precision="0"
                :disabled="settings.autoSceneSelection"
                density="compact"
                variant="outlined"
                control-variant="stacked"
                hide-details
                class="coverage-input"
              ></v-number-input>
            </v-col>
          </v-row>
          <v-row>
            <v-col>
              <v-slider
                v-model="settings.areaCoverage"
                min="1"
                max="100"
                step="1"
                :disabled="settings.autoSceneSelection"
                color="teal"
                track-color="grey-darken-2"
                thumb-color="teal"
                hide-details
                @update:model-value="updateAreaCoverageSlider"
              />
            </v-col>
          </v-row>
          <v-row v-if="settings.autoSceneSelection">
            <v-col>
              <v-alert color="gray" type="info" variant="tonal" density="compact">
                Area coverage is not relevant when automatic scene selection is enabled.
              </v-alert>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Scene Selection -->
      <v-expansion-panel value="scene-selection">
        <v-expansion-panel-title>
          <span class="header-text">
            Scene Selection Mode
            <v-badge
              v-if="settings.autoSceneSelection"
              inline
              color="teal"
              content="Automatic"
            ></v-badge>
            <v-badge v-else inline color="warning" content="Manual"></v-badge>
            <template v-if="settings.autoSceneSelection">
              <v-badge
                v-if="sceneSelectionStatus === true"
                inline
                color="success"
                content="Selected"
              ></v-badge>
              <v-badge
                v-if="sceneSelectionStatus === false"
                inline
                color="error"
                content="Failed"
              ></v-badge>
            </template>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-row>
            <v-col>
              <v-checkbox v-model="settings.autoSceneSelection" density="compact" hide-details
                ><template v-slot:label>Automatic Scene Selection </template>
              </v-checkbox>
            </v-col>
          </v-row>
          <v-row>
            <v-col>
              <v-alert color="gray" type="info" density="compact">
                When checked, a suitable scene will be automatically chosen based on the selected
                year and the crop calendar for the selected area. When not checked, two scenes have
                to be selected manually - one for the time around planting and one for the time
                around harvest.
              </v-alert>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Scene A -->
      <v-expansion-panel value="win-a">
        <v-expansion-panel-title>
          <span class="header-text">
            Scene<template v-if="!modelIsSingleShot">&nbsp;A</template>
            <v-badge v-if="!activeTileId" inline color="error" content="Missing"></v-badge>
            <v-badge
              v-else
              inline
              color="teal"
              :content="firstTile?.date || activeTileId"
            ></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="results">
            <!-- Show second accordion's active tile first -->
            <TilePreview v-if="activeTileId" :tileId="activeTileId" win="a" />
            <!-- Show other results -->
            <TilePreview
              v-for="result in resultsA"
              :key="result?.id"
              win="a"
              :tileId="result?.id"
            />
            <v-alert v-if="!hasMore" class="mb-2 mt-2" color="teal" type="info" density="compact">
              <p class="mb-2">
                No more images found. Try adjusting your filters (date range, cloud cover, area
                coverage) to increase the likelihood of finding more results.
              </p>
              <p>
                You can provide your own EarthSearch STAC Item ID if you didn't find what you were
                looking for:<br />
                <v-text-field
                  v-model="activeTileId"
                  type="text"
                  label="STAC Item ID"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="mt-2"
                />
              </p>
            </v-alert>
            <v-btn
              v-if="hasMore"
              @click="loadMore"
              class="action-button mt-4"
              :disabled="isLoading"
            >
              <template v-if="isLoading">Loading...</template>
              <template v-else>Load more</template>
            </v-btn>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Scene B -->
      <v-expansion-panel v-if="!modelIsSingleShot" value="win-b" :disabled="!activeTileId">
        <v-expansion-panel-title>
          <span class="header-text">
            Scene B
            <v-badge v-if="!secondActiveTileId" inline color="error" content="Missing"></v-badge>
            <v-badge
              v-else
              inline
              color="teal"
              :content="secondTile?.date || secondActiveTileId"
            ></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="results">
            <!-- Show second accordion's active tile first -->
            <TilePreview v-if="secondActiveTileId" :tileId="secondActiveTileId" win="b" />
            <!-- Show other results -->
            <TilePreview
              v-for="result in resultsB"
              :key="result?.id"
              win="b"
              :tileId="result?.id"
            />
            <v-alert v-if="!hasMore" class="mb-2 mt-2" color="teal" type="info" density="compact">
              <p class="mb-2">
                No more images found. Try adjusting your filters (date range, cloud cover, area
                coverage) to increase the likelihood of finding more results.
              </p>
              <p>
                You can provide your own EarthSearch STAC Item ID if you didn't find what you were
                looking for:<br />
                <v-text-field
                  v-model="secondActiveTileId"
                  type="text"
                  label="STAC Item ID"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="mt-2"
                />
              </p>
            </v-alert>
            <v-btn
              v-if="hasMore"
              @click="loadMore"
              class="action-button mt-4"
              :disabled="isLoading"
            >
              <template v-if="isLoading">Loading...</template>
              <template v-else>Load more</template>
            </v-btn>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>

  <div class="action-buttons">
    <v-btn
      v-if="isBatchProcessing"
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
    </v-btn>
    <v-btn
      v-if="!isBatchProcessing"
      class="action-button"
      :disabled="!activeTileId || (!modelIsSingleShot && !secondActiveTileId) || isProcessing"
      @click="handleSmallAreaProcessingRequest"
    >
      <span v-if="isProcessing"
        ><v-progress-circular indeterminate size="16" width="2" class="me-1" /> Processing...</span
      >
      <span v-else>Start processing</span>
    </v-btn>
  </div>
</template>

<style scoped>
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

.settings .v-expansion-panel-title .v-badge {
  margin-left: 0.25rem;
}

.settings .header-text {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.coverage-input {
  width: 100px;
}

.action-buttons {
  flex: 0;
  padding: 0.5rem 1rem 1rem 1rem;
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
</style>
