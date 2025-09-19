<script setup lang="ts">
import { fromExtent } from 'ol/geom/Polygon'
import { ref, watch } from 'vue'
import ProcessingPanel from './ProcessingPanel.vue'
import SettingsModal from './SettingsModal.vue'
import SearchModal from './SearchModal.vue'
import { useSearch } from '../composables/useSearch'
import { getArea } from 'ol/sphere'
import { useAreaOfInterest } from '../composables/useAreaOfInterest'
import { mdiCog, mdiInformation, mdiMagnify } from '@mdi/js'
import { useProcessingMode } from '../composables/useProcessingMode'
import { useMap } from '../composables/useMap'
import { useSettings } from '../composables/useSettings'

const emit = defineEmits<{
  (e: 'updateGeoJSONResults', results: any[]): void
}>()

const { map, areaValues } = useMap()
const { currentBbox, handleSearchResults } = useSearch()
const { drawnExtent, currentMgrsTileId, triggerTileSelection, activeTileId, secondActiveTileId } =
  useAreaOfInterest()

const { processingMode } = useProcessingMode()
const ftwAboutDialogShown = localStorage.getItem('ftw-about-dialog-shown') !== 'true'
const aboutDialog = ref(ftwAboutDialogShown)
const dontShowAgain = ref(!ftwAboutDialogShown)

watch(dontShowAgain, (newValue) => {
  localStorage.setItem('ftw-about-dialog-shown', String(newValue))
})

// Settings state
const isSettingsModalOpen = ref(false)
const isSearchModalOpen = ref(false)

const { settings } = useSettings()

watch(drawnExtent, (newValue) => {
  if (!currentBbox.value) return
  processingMode.value =
    newValue && getArea(fromExtent(newValue)) < 200000000 // 200 km² threshold
      ? 'smallAreaProcessing'
      : 'batchProcessing'
})

const handleSettingsClick = () => {
  isSettingsModalOpen.value = true
}

const handleSettingsSave = (newSettings: any) => {
  settings.value = newSettings

  // If there's an active search area, refresh the search with new settings
  if (currentBbox.value && currentMgrsTileId.value) {
    // Trigger a new search with the updated settings
    handleSearchResults(currentMgrsTileId.value, currentBbox.value, newSettings)
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

// Handle bbox selection from search modal
const handleBboxSelected = (bbox: number[]) => {
  // Set the drawn extent for the area of interest
  drawnExtent.value = bbox

  // For bbox searches, we don't have a specific tile ID, so we'll use a placeholder
  // and trigger the search with the custom bbox
  const placeholderTileId = `bbox_${Date.now()}`

  // Trigger the search with the custom bbox
  handleSearchResults(placeholderTileId, bbox, settings.value)
}

// Handle setting currentMgrsTileId from search modal
const handleSetCurrentMgrsTileId = (tileId: string) => {
  currentMgrsTileId.value = tileId
}

// Handle setting activeTileId from search modal
const handleSetActiveTileId = (tileId: string) => {
  activeTileId.value = tileId
}

// Handle setting secondActiveTileId from search modal
const handleSetSecondActiveTileId = (tileId: string) => {
  secondActiveTileId.value = tileId
}

// Handle combined tile and bbox selection from search modal
const handleTileAndBboxSelected = (tileName: string, bbox?: number[]) => {
  // Find the tile feature on the map and trigger the tile selection with bbox
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
      // Use the updated triggerTileSelection with bbox parameter
      triggerTileSelection(map.value!, tileName, areaValues.value!, handleSearchResults, bbox)
    }
  }
}
</script>

<template>
  <div class="data-cabinet">
    <div class="header-container">
      <h2>Fields of the World: Inference App</h2>
      <v-btn
        density="compact"
        variant="plain"
        :icon="mdiCog"
        @click="handleSettingsClick"
        title="Settings"
      ></v-btn>
      <v-btn
        density="compact"
        variant="plain"
        :icon="mdiMagnify"
        @click="isSearchModalOpen = true"
        title="Search S2 Tiles"
      ></v-btn>
      <v-btn
        density="compact"
        variant="plain"
        :icon="mdiInformation"
        @click="aboutDialog = true"
        title="About"
      ></v-btn>
    </div>
    <ProcessingPanel
      v-if="map"
      is-open
      @updateGeoJSONResults="
        (results: any[]) => {
          emit('updateGeoJSONResults', results)
        }
      "
    />

    <!-- Settings Modal -->
    <SettingsModal
      :is-open="isSettingsModalOpen"
      :initial-settings="settings"
      @update:is-open="isSettingsModalOpen = $event"
      @save="handleSettingsSave"
    />

    <!-- Search Modal -->
    <SearchModal
      :is-open="isSearchModalOpen"
      @update:is-open="isSearchModalOpen = $event"
      @tile-selected="handleTileSelected"
      @bbox-selected="handleBboxSelected"
      @tile-and-bbox-selected="handleTileAndBboxSelected"
      @set-current-mgrs-tile-id="handleSetCurrentMgrsTileId"
      @set-active-tile-id="handleSetActiveTileId"
      @set-second-active-tile-id="handleSetSecondActiveTileId"
    />

    <!-- About Dialog -->
    <v-dialog v-model="aboutDialog" width="auto">
      <v-card max-width="600" border :prepend-icon="mdiInformation" title="About the Inference App">
        <v-card-text>
          Welcome to the Fields of the World (FTW) Web App. Use it to run the FTW model on
          Sentinel-2 imagery and generate predicted field boundaries for your chosen area of
          interest. To get started, either zoom in or click on your area of interest.
        </v-card-text>
        <v-card-actions>
          <v-checkbox-btn v-model="dontShowAgain" label="Don't show again"></v-checkbox-btn>
          <v-spacer></v-spacer>
          <v-btn variant="flat" color="primary" text="Ok" @click="aboutDialog = false"></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.data-cabinet {
  position: absolute;
  top: 1rem;
  right: 1rem;
  min-width: 300px;
  width: 30vw;
  max-width: 600px;
  height: calc(100vh - 4rem);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 1rem;
  border-radius: 4px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

h2 {
  margin: 0;
  font-size: 1.25rem;
  color: white;
  flex: 1;
}
</style>
