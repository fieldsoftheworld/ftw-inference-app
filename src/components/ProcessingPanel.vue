<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, shallowRef } from 'vue'
import { type Extent } from 'ol/extent'
import { generateJWT } from '../functions/generate-jwt'
import { transformExtent } from 'ol/proj'
import searchStacApi from '../functions/search-stac-api'
import useSearch, { type SearchResult } from '../composables/useSearch'
import useBatchProcessing from '../composables/useProcessing'
import useSettings, { type Settings } from '../composables/useSettings'
import useNotifier from '../composables/useNotifier'
import useAreaOfInterest from '../composables/useAreaOfInterest'
import useProcessingMode from '../composables/useProcessingMode'
import useMap from '../composables/useMap'
import {
  mdiInformationOutline,
  mdiCheckBold,
  mdiExclamationThick,
  mdiClose,
  mdiEyeOutline,
  mdiEyeOffOutline,
} from '@mdi/js'
import TilePreview from './TilePreview.vue'
import GeocodingSearch from './GeocodingSearch.vue'
import useStacLayer from '../composables/useStacLayer'
import { debounce } from 'vuetify/lib/util/helpers.mjs'
import { getEffectiveCloudlessYear } from '../layers/S2-Cloudless-Layer'

const emit = defineEmits<{
  (e: 'workStateChanged', isWorking: boolean): void
}>()

const { map, areaValues } = useMap()
const { stacPreviewTileId } = useStacLayer()
const { drawnExtent, validateBBox, getTileById, triggerTileSelection, handleLocationSelected } =
  useAreaOfInterest()
const { showError, showSuccess } = useNotifier()
const { hasMore, isLoading, searchResults, searchStatus, handleSearchResults } = useSearch()
const { activeTileId, currentBBox, currentBBoxValid, secondActiveTileId, currentMgrsTileId } =
  useAreaOfInterest()
const { settings, availableModels, modelIsSingleShot, modelTitle } = useSettings()
const { isBatchProcessing } = useProcessingMode()
const { processBatch, processSmallArea, isProcessing } = useBatchProcessing()

const months = [
  { value: 0, title: 'Default' },
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

watch(currentMgrsTileId, (newValue, oldValue) => {
  if (oldValue && !newValue) {
    activePanel.value = 'aoi'
  }
  if (!oldValue && newValue) {
    activePanel.value = null
  }
})

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
const activePanel = ref<string | null>(currentMgrsTileId.value ? null : 'aoi')
const hasLoadedMore = ref(false)
const sceneSelectionStatus = ref<boolean | null>(null)
const sceneYears = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)

const basemapYearMismatch = computed(
  () => settings.value.year !== getEffectiveCloudlessYear(settings.value.year),
)

const isSelectingScenes = computed(
  () => sceneSelectionStatus.value === null && settings.value.autoSceneSelection,
)

let abortController: AbortController | null = null
watch(
  [currentBBox, settings],
  debounce(async ([currentBBox, newSettings]: [number[] | null, Settings]) => {
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
          buffer_days: newSettings.buffer,
        }),
        signal: abortController.signal,
      })
      abortController = null // Clear abortController on successful fetch
      const data = await response.json()
      if (response.status !== 200) {
        if (data.detail) {
          if (data.detail.toLowerCase().includes('no sentinel scenes within')) {
            data.detail += ' Please adjust the year, buffer or select the scenes manually.'
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

      // Display Scene A image by default when auto scene selection is enabled
      if (settings.value.autoSceneSelection && activeTileId.value) {
        stacPreviewTileId.value = activeTileId.value
      }

      if (!settings.value.expertMode) {
        showSuccess(
          'Scenes have been selected automatically. You can start processing or adjust the scenes or your settings.',
        )
      }
    } catch (error) {
      if (error !== 'obsolete request') {
        sceneSelectionStatus.value = false
        console.error('Error during auto scene selection:', error)
        showError(
          'Failed to perform auto scene selection: ' +
            (error instanceof Error ? error.message : 'Unknown error'),
        )
      }
    }
  }, 500),
  { deep: true },
)

// todo: check whether we should only run on a subset of settings
watch(
  [settings, currentBBox],
  debounce(async () => {
    // If there's an active search area, refresh the search with new settings
    if (currentBBox.value && currentMgrsTileId.value) {
      // Trigger a new search with the updated settings
      await handleSearchResults(currentMgrsTileId.value, currentBBox.value, settings.value)
    }
  }, 500),
  { deep: true },
)

const availableTiles = shallowRef<any[]>([])

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
      ((layer as any).getSource && (layer as any).getSource().getFeatures),
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
const firstTile = shallowRef<SearchResult | null>(null)
const secondTile = shallowRef<SearchResult | null>(null)
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

// Display Scene A image by default when auto scene selection is enabled and a scene is selected
watch([() => settings.value.autoSceneSelection, activeTileId], ([autoSelection, tileId]) => {
  if (autoSelection && tileId) {
    stacPreviewTileId.value = tileId
  }
})

watch(map, () => loadAvailableTiles())

const sortAsc = (a: SearchResult, b: SearchResult) => {
  return (a.isoDate || a.id).localeCompare(b.isoDate || b.id)
}
const sortDesc = (a: SearchResult, b: SearchResult) => {
  return (b.isoDate || b.id).localeCompare(a.isoDate || a.id)
}

const resultsA = computed(() => {
  return searchResults.value.slice(0).sort(sortAsc)
})
const resultsB = computed(() => {
  return searchResults.value.filter((r) => r.id !== activeTileId.value).sort(sortDesc)
})

// Function to load more results
const loadMore = async () => {
  isLoading.value = true
  let firstNewItemId: string | null = null

  searchStatus.value = true
  try {
    const response = await searchStacApi(
      currentMgrsTileId.value,
      currentBBox.value,
      false,
      settings.value,
    )
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
      `Error loading more results: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

// Handle tile selection from search modal
const handleTileSelected = (tileName: string) => {
  // Find the tile feature on the map and trigger the tile selection
  const layers = map.value!.getLayers().getArray()
  const s2GridLayer = layers.find(
    (layer) =>
      layer.get('name') === 's2-grid' ||
      (layer.get('properties') && layer.get('properties').name === 's2-grid') ||
      ((layer as any).getSource && (layer as any).getSource().getFeatures),
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

const getStatus = (condition: any, warn: boolean = false) => {
  const success = Boolean(condition)
  return {
    inline: true,
    color: success ? 'success' : warn ? 'warning' : 'error',
    icon: success ? mdiCheckBold : warn ? mdiExclamationThick : mdiClose,
  }
}

const openModelSelection = () => {
  settings.value.expertMode = true
  activePanel.value = 'model'
}
defineExpose({ openModelSelection })
</script>

<template>
  <div class="settings">
    <v-alert
      density="compact"
      :type="isBatchProcessing ? 'warning' : 'info'"
      :color="isBatchProcessing ? 'warning' : 'gray'"
      class="mb-2 introduction"
    >
      <template v-if="!currentMgrsTileId">
        <strong>Please select an area of interest.</strong> Click on the map to select an area or
        use the search box below.
      </template>
      <template v-else-if="isBatchProcessing">
        You are in <strong>batch mode</strong> due to the selected larger area. The processing may
        take multiple minutes depending on the selected settings.
      </template>
      <template v-else>
        You are in <strong>small area mode</strong>. The processing usually takes less than 30
        seconds. Use this for a quick preview on smaller areas.
      </template>
    </v-alert>

    <v-row class="d-flex justify-center w-100 mx-auto">
      <v-col>
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
      <v-expansion-panel v-if="currentMgrsTileId && isBatchProcessing" value="project">
        <v-expansion-panel-title>
          <span class="header-text">
            <v-badge v-bind="getStatus(projectTitle)"></v-badge>
            Project
            <v-badge v-if="projectTitle" inline color="teal" :content="projectTitle"></v-badge>
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
      <v-expansion-panel v-if="currentMgrsTileId && settings.expertMode" value="model">
        <v-expansion-panel-title>
          <span class="header-text">
            <v-badge v-bind="getStatus(modelTitle)"></v-badge>
            Model
            <v-badge v-if="modelTitle" inline color="teal" :content="modelTitle"></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-radio-group v-model="settings.model" inline hide-details>
            <v-radio v-for="model in availableModels" :key="model.id" :value="model.id" color="teal"
              ><template v-slot:label>
                {{ model.title }}
                <v-tooltip v-if="model.description" max-width="400" open-on-click>
                  <template #activator="{ props }">
                    <v-icon
                      class="ml-1"
                      :icon="mdiInformationOutline"
                      size="small"
                      v-bind="props"
                    ></v-icon>
                  </template>
                  <div>
                    <template v-if="model.version"
                      ><strong>Version:</strong> {{ model.version }}<br
                    /></template>
                    <strong>License:</strong> {{ model.license || 'unknown' }}<br />
                    <template v-if="model.description">
                      <strong>Description:</strong>
                      <div style="white-space: pre-wrap">
                        {{ model.description }}
                      </div>
                    </template>
                  </div>
                </v-tooltip>
                <v-badge
                  v-if="model.legacy"
                  inline
                  color="black"
                  title="Legacy Model"
                  content="Legacy"
                ></v-badge>
                <v-badge
                  v-if="model.default"
                  inline
                  color="success"
                  title="Default model, recommended choice by the FTW team"
                  content="Recommended"
                ></v-badge> </template
            ></v-radio>
          </v-radio-group>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Area of Interest -->
      <v-expansion-panel value="aoi">
        <v-expansion-panel-title>
          <span class="header-text">
            <v-badge v-bind="getStatus(currentMgrsTileId && currentBBoxValid === true)"></v-badge>
            Area
            <v-badge
              v-if="currentMgrsTileId"
              inline
              color="teal"
              :content="`Tile: ${currentMgrsTileId}`"
            ></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <!-- Geocoding -->
          <v-row>
            <v-col>
              <GeocodingSearch @location-selected="handleLocationSelected" />
            </v-col>
          </v-row>

          <!-- Grid Selection Dropdown -->
          <v-row v-if="settings.expertMode">
            <v-col>
              <v-autocomplete
                v-model="currentMgrsTileId"
                @update:model-value="handleTileSelected"
                label="MGRS Tile Selection"
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
                >Please select an area of interest on the map by clicking on the map. Then adjust
                the bounding box.</v-alert
              >
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Time -->
      <v-expansion-panel v-if="currentMgrsTileId" value="time">
        <v-expansion-panel-title>
          <span class="header-text">
            <v-badge v-bind="getStatus(settings.year)"></v-badge>
            Time
            <v-badge
              v-if="settings.year"
              inline
              color="teal"
              :content="`Year: ${settings.year}`"
            ></v-badge>
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

          <v-row v-if="basemapYearMismatch">
            <v-col>
              <v-alert type="warning" variant="tonal" density="compact">
                No basemap is available for {{ settings.year }}. Showing the
                {{ getEffectiveCloudlessYear(settings.year) }} basemap instead.
              </v-alert>
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
                item-value="value"
                item-title="title"
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
                item-value="value"
                item-title="title"
              />
            </v-col>
          </v-row>
          <v-row>
            <v-col>
              <v-alert color="gray" type="info" variant="tonal" density="compact">
                Select a year for the scene selection. Automatic scene selection will automatically
                choose start and end dates based on crop calendars. Thus, start and end date
                selection will only be available for manual scene selection.<br />
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
      <v-expansion-panel v-if="currentMgrsTileId && settings.expertMode" value="coverage">
        <v-expansion-panel-title>
          <span class="header-text">
            <v-badge v-bind="getStatus(settings.cloudCover <= 50, true)"></v-badge>
            Coverage
            <v-badge inline color="blue" :content="`Cloud: ${settings.cloudCover}%`"></v-badge>
            <v-badge
              v-if="!settings.autoSceneSelection"
              inline
              color="brown"
              :content="`Area: ${settings.areaCoverage}%`"
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
                v-model.number="settings.cloudCover"
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
                v-model.number="settings.cloudCover"
                :min="1"
                :max="100"
                :step="1"
                color="teal"
                track-color="grey-darken-2"
                thumb-color="teal"
                hide-details
              />
            </v-col>
          </v-row>
          <v-row v-if="settings.cloudCover > 50">
            <v-col>
              <v-alert type="warning" variant="tonal" density="compact">
                Cloud cover above 50% may decrease the probability of getting accurate results. Try
                to select an area without clouds.
              </v-alert>
            </v-col>
          </v-row>
          <!-- Area Coverage -->
          <template v-if="!settings.autoSceneSelection">
            <v-row>
              <v-col cols="6">
                <v-label class="text-subtitle-2">Area Coverage (%)</v-label>
              </v-col>
              <v-col cols="6" class="d-flex justify-end">
                <v-number-input
                  v-model.number="settings.areaCoverage"
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
                  v-model.number="settings.areaCoverage"
                  :min="1"
                  :max="100"
                  :step="1"
                  color="teal"
                  track-color="grey-darken-2"
                  thumb-color="teal"
                  hide-details
                />
              </v-col>
            </v-row>
          </template>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Scene Selection -->
      <v-expansion-panel v-if="currentMgrsTileId" value="scene-selection">
        <v-expansion-panel-title>
          <span class="header-text">
            <v-badge
              v-bind="
                getStatus(
                  settings.autoSceneSelection &&
                    (!settings.autoSceneSelection || settings.buffer >= 14),
                  true,
                )
              "
            ></v-badge>
            Scene Selection
            <v-badge
              v-if="settings.autoSceneSelection"
              inline
              color="teal"
              content="Automatic"
            ></v-badge>
            <v-badge v-else inline color="warning" content="Manual"></v-badge>
            <v-badge
              v-if="settings.autoSceneSelection"
              inline
              color="teal"
              :content="`Buffer: ${settings.buffer} days`"
            ></v-badge>
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-row>
            <v-col>
              <v-checkbox v-model="settings.autoSceneSelection" density="compact" hide-details
                ><template v-slot:label>Automatic Scene Selection</template>
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

          <template v-if="settings.autoSceneSelection">
            <v-row>
              <v-col cols="6">
                <v-label class="text-subtitle-2">Search Buffer (days)</v-label>
              </v-col>
              <v-col cols="6" class="d-flex justify-end">
                <v-number-input
                  v-model.number="settings.buffer"
                  :min="1"
                  :max="60"
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
                  v-model.number="settings.buffer"
                  :min="1"
                  :max="60"
                  :step="1"
                  color="teal"
                  track-color="grey-darken-2"
                  thumb-color="teal"
                  hide-details
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col>
                <v-alert
                  v-if="settings.buffer < 14"
                  type="warning"
                  variant="tonal"
                  density="compact"
                >
                  A search buffer of less than 14 days may decrease the probability of getting
                  results for automatic scene selection.
                </v-alert>
              </v-col>
            </v-row>
          </template>
        </v-expansion-panel-text>
      </v-expansion-panel>
      <!-- Scene A -->
      <v-expansion-panel v-if="currentMgrsTileId" value="win-a" class="scenes">
        <v-expansion-panel-title>
          <span class="header-text">
            <v-badge v-bind="getStatus(activeTileId)"></v-badge>
            Scene<template v-if="!modelIsSingleShot">&nbsp;A</template>
            <v-badge
              v-if="activeTileId"
              inline
              color="teal"
              :content="firstTile?.date || activeTileId"
            ></v-badge>
          </span>
          <v-spacer></v-spacer>
          <v-tooltip
            v-if="activeTileId"
            :text="stacPreviewTileId === activeTileId ? 'Hide scene A image' : 'Show scene A image'"
            open-on-click
          >
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                :icon="stacPreviewTileId === activeTileId ? mdiEyeOutline : mdiEyeOffOutline"
                density="compact"
                @click.stop="
                  stacPreviewTileId = stacPreviewTileId === activeTileId ? null : activeTileId
                "
              ></v-btn>
            </template>
          </v-tooltip>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="results">
            <!-- Show first accordion's active tile first -->
            <template v-if="activeTileId">
              <v-row
                ><v-col class="text-center"
                  ><v-label class="text-overline ma-1">Selected</v-label></v-col
                ></v-row
              >
              <TilePreview :tileId="activeTileId" win="a" />
            </template>
            <!-- Show other results -->
            <v-row v-if="resultsA.length > 0"
              ><v-col class="text-center"
                ><v-label class="text-overline ma-1 mt-4">All Search Results</v-label></v-col
              ></v-row
            >
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
      <v-expansion-panel
        v-if="currentMgrsTileId && !modelIsSingleShot"
        class="scenes"
        value="win-b"
        :disabled="!activeTileId"
      >
        <v-expansion-panel-title>
          <span class="header-text">
            <v-badge v-bind="getStatus(secondActiveTileId)"></v-badge>
            Scene B
            <v-badge
              v-if="secondActiveTileId"
              inline
              color="teal"
              :content="secondTile?.date || secondActiveTileId"
            ></v-badge>
          </span>
          <v-spacer></v-spacer>
          <v-tooltip
            v-if="secondActiveTileId"
            :text="
              stacPreviewTileId === secondActiveTileId ? 'Hide scene B image' : 'Show scene B image'
            "
            open-on-click
          >
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                :icon="stacPreviewTileId === secondActiveTileId ? mdiEyeOutline : mdiEyeOffOutline"
                density="compact"
                @click.stop="
                  stacPreviewTileId =
                    stacPreviewTileId === secondActiveTileId ? null : secondActiveTileId
                "
              ></v-btn>
            </template>
          </v-tooltip>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="results">
            <!-- Show second accordion's active tile first -->
            <template v-if="secondActiveTileId">
              <v-row
                ><v-col class="text-center"
                  ><v-label class="text-overline ma-1">Selected</v-label></v-col
                ></v-row
              >
              <TilePreview :tileId="secondActiveTileId" win="b" />
            </template>
            <!-- Show other results -->
            <v-row v-if="resultsB.length > 0"
              ><v-col class="text-center"
                ><v-label class="text-overline ma-1 mt-4">All Search Results</v-label></v-col
              ></v-row
            >
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
:deep(.scenes .v-expansion-panel-text__wrapper) {
  padding: 0;
}
.scenes .results {
  flex: 1;
  transition: opacity 0.3s ease;
  min-height: 300px;
  max-height: 50vh;
  overflow-y: scroll;
}

.settings .v-expansion-panel-title .v-badge:not(:first-child) {
  margin-left: 0.25rem;
}

.settings .header-text {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
}

.coverage-input {
  width: 100px;
}
</style>
