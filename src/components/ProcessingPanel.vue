<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted } from 'vue'
import { type Extent } from 'ol/extent'
import { generateJWT } from '../functions/generate-jwt'
import { transformExtent } from 'ol/proj'
import searchStacApi from '../functions/search-stac-api'
import useSearch, { type SearchResult } from '../composables/useSearch'
import useBatchProcessing from '../composables/useProcessing'
import useSettings from '../composables/useSettings'
import useNotifier from '../composables/useNotifier'
import useAreaOfInterest from '../composables/useAreaOfInterest'
import useProcessingMode from '../composables/useProcessingMode'
import useGeocoding from '../composables/useGeocoding'
import useMap from '../composables/useMap'
import { mdiHelpCircleOutline } from '@mdi/js'
import TilePreview from './TilePreview.vue'

const emit = defineEmits<{
  (e: 'workStateChanged', isWorking: boolean): void
}>()

const { map, areaValues } = useMap()
const { drawnExtent, validateBBox, getTileById, triggerTileSelection } = useAreaOfInterest()
const { showError, showSuccess } = useNotifier()
const { hasMore, isLoading, searchResults, searchStatus, handleSearchResults } = useSearch()
const { activeTileId, currentBBox, currentBBoxValid, secondActiveTileId, currentMgrsTileId } =
  useAreaOfInterest()
const { settings, collections, availableCollections, availableModels, modelIsSingleShot } =
  useSettings()
const { isBatchProcessing } = useProcessingMode()
const { placeSearch, isLoadingPlaces, suggestedPlaces, handleLocationSelected } = useGeocoding()
const { processBatch, processSmallArea, isProcessing } = useBatchProcessing()

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

watch(currentBBox, (newValue) => {
  if (activePanel.value !== 'aoi' && !settings.value.autoSceneSelection && newValue) {
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

const projectTitle = ref(new Date().toISOString())
const activePanel = ref<string | null>(null)
const hasLoadedMore = ref(false)
const sceneSelectionStatus = ref<boolean | null>(null)
const sceneYears = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)

const isSelectingScenes = computed(
  () => sceneSelectionStatus.value === null && settings.value.autoSceneSelection
)

let abortController: AbortController | null = null
watch(
  [currentBBox, settings],
  async ([currentBBox, newSettings]) => {
    if (!newSettings.autoSceneSelection || !currentBBox || !newSettings.year) {
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
          bbox: currentBBox,
          year: newSettings.year,
          cloud_cover_max: newSettings.cloudCover,
        }),
        signal: abortController.signal,
      })
      abortController = null // Clear abortController on successful fetch
      const data = await response.json()
      if (response.status !== 200) {
        if (data.detail) {
          if (data.detail.toLowerCase().includes('no sentinel scenes within')) {
            data.detail += ' Please adjust the year or select the scenes manually.'
          }
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
      if (!settings.value.expertMode) {
        showSuccess(
          'Scenes have been selected automatically. You can start processing or adjust the scenes or your settings.'
        )
      }
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
  },
  { deep: true }
)

// todo: check whether we should only run on a subset of settings
watch(
  [settings, currentBBox],
  () => {
    // If there's an active search area, refresh the search with new settings
    if (currentBBox.value && currentMgrsTileId.value) {
      // Trigger a new search with the updated settings
      handleSearchResults(currentBBox.value, settings.value)
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
const bbox = ref<number[]>(currentBBox.value || [-180.0, -90.0, 180.0, 90.0])

const syncBBox = (newValue?: Extent) => {
  if (!newValue) {
    return
  }
  const newExtent = transformExtent(newValue, 'EPSG:3857', 'EPSG:4326')
  if (Array.isArray(newExtent) && newExtent.length === bbox.value.length) {
    for (let i = 0; i < bbox.value.length; i++) {
      if (newExtent[i] !== bbox.value[i]) {
        bbox.value[i] = newExtent[i]
      }
    }
  }
}
// @ts-ignore
watch(drawnExtent, syncBBox, { immediate: true, deep: 1 })

const updateBBox = (index: number, value: number) => {
  bbox.value[index] = value
  if (validateBBox(bbox.value)) {
    currentBBox.value = bbox.value.slice(0)
    const extent = transformExtent(bbox.value, 'EPSG:4326', 'EPSG:3857')
    drawnExtent.value = extent
  }
}

onMounted(() => {
  loadAvailableTiles()
  syncBBox(currentBBox.value)
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
watch([isProcessing, isSelectingScenes], () => {
  emit('workStateChanged', isProcessing.value || isSelectingScenes.value)
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
    const response = await searchStacApi(currentBBox.value, false, settings.value)
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

const processingDisabled = computed(() => {
  return (
    !activeTileId.value ||
    (!modelIsSingleShot.value && !secondActiveTileId.value) ||
    isProcessing.value ||
    (settings.value.autoSceneSelection && isSelectingScenes.value) ||
    currentBBoxValid.value !== true
  )
})

const process = () => {
  if (isBatchProcessing.value) {
    processBatch(projectTitle.value, firstTile.value, secondTile.value)
  } else {
    processSmallArea(firstTile.value, secondTile.value)
  }
}
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
      <!-- Area of Interest -->
      <v-expansion-panel value="aoi">
        <v-expansion-panel-title>
          <span class="header-text">
            Area of Interest
            <v-badge
              v-if="currentMgrsTileId"
              inline
              color="teal"
              :content="currentMgrsTileId"
            ></v-badge>
            <v-badge v-else inline color="error" content="Missing"></v-badge>
            <v-badge
              v-if="currentMgrsTileId && currentBBoxValid !== true"
              inline
              color="error"
              content="Invalid"
            ></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <!-- Geocoding -->
          <v-row>
            <v-col>
              <v-autocomplete
                @update:model-value="handleLocationSelected"
                v-model:search="placeSearch"
                :loading="isLoadingPlaces"
                :items="suggestedPlaces"
                label="Search for a place"
                hide-details
                dense
                variant="outlined"
              ></v-autocomplete>
            </v-col>
          </v-row>

          <!-- Grid Selection Dropdown -->
          <v-row v-if="settings.expertMode">
            <v-col>
              <v-autocomplete
                v-model="currentMgrsTileId"
                @update:model-value="handleTileSelected"
                label="MGRS Grid Selection"
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
              <v-label> Bounding Box </v-label>
            </v-col>
          </v-row>
          <template v-if="settings.expertMode">
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
          </template>
          <v-row v-if="typeof currentBBoxValid === 'string'">
            <v-col>
              <v-alert color="error" type="error" variant="tonal" density="compact">
                {{ currentBBoxValid }}
              </v-alert>
            </v-col>
          </v-row>
          <v-row v-else-if="!settings.expertMode">
            <v-col>
              <v-alert color="gray" type="info" variant="tonal" density="compact"
                >Please select an area of interest on the map by clicking on the map. Then adjusting
                the bounding box.</v-alert
              >
            </v-col>
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
    <v-btn class="action-button" :disabled="processingDisabled" @click="process">
      <span v-if="isProcessing">
        <v-progress-circular indeterminate size="16" width="2" class="me-1" />
        Processing...
      </span>
      <span v-else-if="isBatchProcessing">Create project and start processing</span>
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
