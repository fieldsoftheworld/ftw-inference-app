<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'
import { mdiClose } from '@mdi/js'

const { collections, availableCollections, availableModels, settings, defaultSettings } =
  useSettings()

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
}>()

// Computed property for v-model
const isOpen = computed({
  get: () => props.isOpen,
  set: (value: boolean) => emit('update:isOpen', value),
})

const originalSettings = ref({ ...settings.value })

const closeModal = () => {
  emit('update:isOpen', false)
}

const saveSettings = () => {
  closeModal()
}

onMounted(() => {
  const stored = localStorage.getItem('ftw-search-settings')
  if (!stored) {
    localStorage.setItem('ftw-search-settings', JSON.stringify(defaultSettings))
  }
})

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

const clearDateFilters = () => {
  settings.value.startDate = ''
  settings.value.endDate = ''
}

const resetToDefaults = () => {
  settings.value = { ...defaultSettings }
}

const cancelChanges = () => {
  // Restore original settings
  settings.value = { ...originalSettings.value }
  closeModal()
}

// Initialize settings when modal opens
const initializeSettings = () => {
  if (props.isOpen) {
    originalSettings.value = { ...settings.value }
  }
}

watch(() => props.isOpen, initializeSettings)
</script>

<template>
  <v-dialog v-model="isOpen" max-width="500" persistent scrollable>
    <v-card class="settings-dialog" dark>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>Search Settings</span>
        <v-btn :icon="mdiClose" variant="text" @click="closeModal" />
      </v-card-title>

      <v-card-text>
        <v-form>
          <!-- Data Collection -->
          <v-card variant="outlined" class="mb-2">
            <v-card-text>
              <v-label class="text-subtitle-2 mb-2">Data Collection</v-label>
              <v-radio-group v-model="settings.selectedCollection" inline>
                <v-radio
                  v-for="collection in availableCollections"
                  :key="collection[0]"
                  :label="collections[collection[0]]"
                  :value="collection"
                  color="teal"
                />
              </v-radio-group>
            </v-card-text>
          </v-card>

          <!-- Model Selection -->
          <v-card variant="outlined" class="mb-2">
            <v-card-text>
              <v-label class="text-subtitle-2 mb-2">Model</v-label>
              <v-radio-group v-model="settings.selectedModel" inline>
                <v-radio
                  v-for="{ id, title } in availableModels"
                  :key="id"
                  :label="title"
                  :value="id"
                  color="teal"
                />
              </v-radio-group>
            </v-card-text>
          </v-card>

          <!-- Date Range -->
          <v-card variant="outlined" class="mb-2">
            <v-card-text>
              <v-label class="text-subtitle-2 mb-2">Date Range</v-label>
              <v-row>
                <v-col cols="6">
                  <v-text-field
                    v-model="settings.startDate"
                    type="month"
                    label="Start Date"
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="settings.endDate"
                    type="month"
                    label="End Date"
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
              </v-row>
              <v-btn
                variant="outlined"
                size="small"
                color="grey"
                @click="clearDateFilters"
                class="mt-2"
              >
                Clear Dates
              </v-btn>
            </v-card-text>
          </v-card>

          <!-- Cloud Cover -->
          <v-card variant="outlined" class="mb-2">
            <v-card-text>
              <v-row align="center" class="mb-2">
                <v-col cols="auto">
                  <v-label class="text-subtitle-2">Cloud Cover (%)</v-label>
                </v-col>
                <v-col cols="auto">
                  <v-text-field
                    v-model="settings.cloudCover"
                    type="number"
                    min="1"
                    max="100"
                    variant="outlined"
                    density="default"
                    hide-details
                    style="width: 80px"
                    @update:model-value="updateCloudCoverInput"
                  />
                </v-col>
              </v-row>
              <v-slider
                v-model="settings.cloudCover"
                min="1"
                max="100"
                step="1"
                color="teal"
                track-color="grey-darken-2"
                thumb-color="teal"
                @update:model-value="updateCloudCoverSlider"
              />
              <v-alert
                v-if="settings.cloudCover > 50"
                type="warning"
                variant="tonal"
                density="compact"
                class="mt-2"
              >
                ⚠️ Warning: Cloud cover above 50% may decrease the probability of getting accurate
                results. Try to select an area without clouds.
              </v-alert>
            </v-card-text>
          </v-card>

          <!-- Area Coverage -->
          <v-card variant="outlined" class="mb-2">
            <v-card-text>
              <v-row align="center" class="mb-2">
                <v-col cols="auto">
                  <v-label class="text-subtitle-2">Area Coverage (%)</v-label>
                </v-col>
                <v-col cols="auto">
                  <v-text-field
                    v-model="settings.areaCoverage"
                    type="number"
                    min="1"
                    max="100"
                    variant="outlined"
                    density="default"
                    hide-details
                    style="width: 80px"
                    @update:model-value="updateAreaCoverageInput"
                  />
                </v-col>
              </v-row>
              <v-slider
                v-model="settings.areaCoverage"
                min="1"
                max="100"
                step="1"
                color="teal"
                track-color="grey-darken-2"
                thumb-color="teal"
                @update:model-value="updateAreaCoverageSlider"
              />
            </v-card-text>
          </v-card>
        </v-form>
      </v-card-text>

      <v-card-actions class="justify-end pa-4">
        <v-btn variant="outlined" color="grey" @click="cancelChanges"> Cancel </v-btn>
        <v-btn variant="outlined" color="grey" @click="resetToDefaults"> Reset </v-btn>
        <v-btn variant="flat" color="teal" @click="saveSettings"> Save </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
:deep(.v-field__input) {
  color: white !important;
}

:deep(.v-field__outline) {
  color: rgba(255, 255, 255, 0.2) !important;
}

:deep(.v-field--focused .v-field__outline) {
  color: rgba(0, 136, 136, 0.8) !important;
}

:deep(.v-label) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.v-field__input::placeholder) {
  color: rgba(255, 255, 255, 0.5) !important;
}

:deep(.v-radio .v-selection-control__input) {
  color: rgba(0, 136, 136, 0.8) !important;
}

:deep(.v-radio .v-selection-control__input:hover) {
  color: rgba(0, 136, 136, 1) !important;
}

:deep(.v-slider-track__fill) {
  background-color: rgba(0, 136, 136, 0.8) !important;
}

:deep(.v-slider-thumb__surface) {
  background-color: rgba(0, 136, 136, 0.8) !important;
  border: 2px solid rgba(255, 255, 255, 0.8) !important;
}

:deep(.v-slider-thumb__surface:hover) {
  background-color: rgba(0, 136, 136, 1) !important;
  transform: scale(1.1) !important;
}

:deep(.v-alert) {
  background-color: rgba(255, 193, 7, 0.1) !important;
  border: 1px solid rgba(255, 193, 7, 0.3) !important;
  color: #ffc107 !important;
}

:deep(.v-card) {
  background-color: rgba(0, 0, 0, 0.8) !important;
  border: 1px solid rgba(0, 136, 136, 0.8) !important;
}

:deep(.v-card-text) {
  padding: 0.5rem 0.75rem !important;
}

:deep(.v-btn--variant-outlined) {
  border-color: rgba(255, 255, 255, 0.2) !important;
  color: white !important;
}

:deep(.v-btn--variant-outlined:hover) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.v-btn--variant-flat) {
  background-color: rgba(0, 136, 136, 0.8) !important;
  color: white !important;
}

:deep(.v-btn--variant-flat:hover) {
  background-color: rgba(0, 136, 136, 1) !important;
}
</style>
