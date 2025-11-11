<script setup lang="ts">
import { mdiChevronDown, mdiCog, mdiMagnify } from '@mdi/js'
import { ref } from 'vue'
import { useAreaOfInterest } from '../composables/useAreaOfInterest'
import { useMap } from '../composables/useMap'
import { useSearch } from '../composables/useSearch'
import { useSettings } from '../composables/useSettings'
import { useProcessingMode } from '../composables/useProcessingMode'
import ProcessingPanel from './ProcessingPanel.vue'
import SearchModal from './SearchModal.vue'
import SettingsModal from './SettingsModal.vue'

const emit = defineEmits<{
  (e: 'updateGeoJSONResults', results: any[]): void
}>()

const { map, areaValues } = useMap()
const { currentBbox, handleSearchResults } = useSearch()
const { updateProcessingMode } = useProcessingMode()
const { drawnExtent, currentMgrsTileId, triggerTileSelection, activeTileId, secondActiveTileId } =
  useAreaOfInterest()

// Sidebar state
const isOpen = ref(Boolean(map.value))
const toggleCollapsible = () => {
  isOpen.value = !isOpen.value
}

const isProcessing = ref(false)

// Settings state
const isSettingsModalOpen = ref(false)
const isSearchModalOpen = ref(false)

const { settings } = useSettings()

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
const handleBboxSelected = (bbox: number[], area: number) => {
  // Set the drawn extent for the area of interest
  drawnExtent.value = bbox

  // For bbox searches, we don't have a specific tile ID, so we'll use a placeholder
  // and trigger the search with the custom bbox
  const placeholderTileId = `bbox_${Date.now()}`

  updateProcessingMode(area, areaValues)

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
</script>

<template>
  <v-card
    :loading="isProcessing"
    elevation="8"
    :class="{ closed: !isOpen, 'data-cabinet': true, sidebar: true }"
  >
    <v-card-title class="d-flex align-center justify-space-between pa-2">
      <div class="collapse-action" @click="toggleCollapsible">
        <v-icon
          :class="{ 'rotate-180': isOpen }"
          class="mr-1 text-white transition-transform"
          :icon="mdiChevronDown"
        >
        </v-icon>
        <span class="title text-white">
          Processing
          <v-badge
            v-if="currentMgrsTileId"
            inline
            :content="currentMgrsTileId"
            title="The selected tile identifier"
          ></v-badge>
        </span>
      </div>
      <div class="d-flex align-right gap-2 ms-4">
        <v-btn
          @click="handleSettingsClick"
          variant="plain"
          class="pa-0 action-btn"
          title="Download Results"
          :icon="mdiCog"
        ></v-btn>
        <v-btn
          @click="isSearchModalOpen = true"
          variant="plain"
          class="pa-0 action-btn"
          title="Search S2 Tiles"
          :icon="mdiMagnify"
        ></v-btn>
      </div>
    </v-card-title>

    <div v-show="isOpen" class="content">
      <ProcessingPanel
        v-if="currentMgrsTileId"
        @processing-changed="(v) => (isProcessing = v)"
        @updateGeoJSONResults="
          (results: any[]) => {
            emit('updateGeoJSONResults', results)
          }
        "
      />
      <p v-else class="pa-4 text-center">Select a grid cell to search for Sentinel-2 images.</p>
    </div>
  </v-card>
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
    @set-current-mgrs-tile-id="handleSetCurrentMgrsTileId"
    @set-active-tile-id="handleSetActiveTileId"
    @set-second-active-tile-id="handleSetSecondActiveTileId"
  />
</template>

<style scoped>
.data-cabinet {
  left: 1rem;
  min-width: 300px;
  width: 30vw;
  max-width: 45vw;
}
.data-cabinet.sidebar .content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
