<script setup lang="ts">
import type { Map } from 'ol'
import { fromExtent } from 'ol/geom/Polygon'
import { ref, watch } from 'vue'
import ProcessingPanel from './ProcessingPanel.vue'
import SettingsModal from './SettingsModal.vue'
import { useSearch } from '../composables/useSearch'
import { getArea } from 'ol/sphere'
import { useAreaOfInterest } from '../composables/useAreaOfInterest'
import { mdiCog, mdiInformation } from '@mdi/js'

const props = defineProps<{
  map: Map
}>()

const emit = defineEmits<{
  (e: 'updateGeoJSONResults', results: any[]): void
}>()

const { currentBbox, handleSearchResults } = useSearch()
const { drawnExtent, currentMgrsTileId } = useAreaOfInterest()

const processingMode = ref<'smallAreaProcessing' | 'batchProcessing' | null>('smallAreaProcessing')
const ftwAboutDialogShown = localStorage.getItem('ftw-about-dialog-shown') !== 'true'
const aboutDialog = ref(ftwAboutDialogShown)
const dontShowAgain = ref(!ftwAboutDialogShown)

watch(dontShowAgain, (newValue) => {
  localStorage.setItem('ftw-about-dialog-shown', String(newValue))
})

// Settings state
const isSettingsModalOpen = ref(false)

// Load settings from localStorage or use defaults
const loadSettingsFromStorage = () => {
  const stored = localStorage.getItem('ftw-search-settings')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      return {
        startDate: parsed.startDate || '',
        endDate: parsed.endDate || '',
        cloudCover: parsed.cloudCover || 10,
        areaCoverage: parsed.areaCoverage || 60,
      }
    } catch (error) {
      console.error('Error parsing stored settings:', error)
    }
  }
  return {
    startDate: '',
    endDate: '',
    cloudCover: 10,
    areaCoverage: 60,
  }
}

const settings = ref(loadSettingsFromStorage())

// Apply stored settings to form inputs when component mounts
// const applyStoredSettingsToForm = () => {
//   const startDateInput = document.getElementById('start-date') as HTMLInputElement
//   const endDateInput = document.getElementById('end-date') as HTMLInputElement
//   const cloudCoverInput = document.getElementById('cloud-cover') as HTMLInputElement
//   const areaCoverageInput = document.getElementById('area-coverage') as HTMLInputElement

//   if (startDateInput) startDateInput.value = settings.value.startDate
//   if (endDateInput) endDateInput.value = settings.value.endDate
//   if (cloudCoverInput) cloudCoverInput.value = settings.value.cloudCover.toString()
//   if (areaCoverageInput) areaCoverageInput.value = settings.value.areaCoverage.toString()
// }

// Apply settings to form inputs when component mounts
// applyStoredSettingsToForm()

const handleProcessingToggle = (isOpen: boolean) => {
  if (!currentBbox.value) return
  processingMode.value = isOpen
    ? drawnExtent.value && getArea(fromExtent(drawnExtent.value)) < 200000000 // 200 km² threshold
      ? 'smallAreaProcessing'
      : 'batchProcessing'
    : null
}

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

// Expose methods to parent components
defineExpose({
  handleProcessingToggle: (isOpen: boolean) => handleProcessingToggle(isOpen),
})
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
        :icon="mdiInformation"
        @click="aboutDialog = true"
        title="About"
      ></v-btn>
    </div>
    <ProcessingPanel
      v-if="props.map"
      is-open
      :map="props.map"
      :processing-mode="processingMode"
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
  width: 300px;
  height: 90vh;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 1rem;
  border-radius: 4px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
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
