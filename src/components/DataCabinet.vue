<script setup lang="ts">
import type { Extent } from 'ol/extent'
import type { Map } from 'ol'
import { ref } from 'vue'
import SmallAreaProcessing from './SmallAreaProcessing.vue'
import BatchProcessing from './BatchProcessing.vue'

const props = defineProps<{
  map: Map
}>()

const batchProcessingRef = ref<InstanceType<typeof BatchProcessing> | null>(null)
const activeAccordion = ref<'smallAreaProcessing' | 'batchProcessing' | null>('smallAreaProcessing')

// Settings modal state
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
const applyStoredSettingsToForm = () => {
  const startDateInput = document.getElementById('start-date') as HTMLInputElement
  const endDateInput = document.getElementById('end-date') as HTMLInputElement
  const cloudCoverInput = document.getElementById('cloud-cover') as HTMLInputElement
  const areaCoverageInput = document.getElementById('area-coverage') as HTMLInputElement

  if (startDateInput) startDateInput.value = settings.value.startDate
  if (endDateInput) endDateInput.value = settings.value.endDate
  if (cloudCoverInput) cloudCoverInput.value = settings.value.cloudCover.toString()
  if (areaCoverageInput) areaCoverageInput.value = settings.value.areaCoverage.toString()
}

// Apply settings to form inputs when component mounts
applyStoredSettingsToForm()

const handleSmallAreaProcessingToggle = (isOpen: boolean) => {
  activeAccordion.value = isOpen ? 'smallAreaProcessing' : null
}

const handleBatchProcessingToggle = (isOpen: boolean) => {
  activeAccordion.value = isOpen ? 'batchProcessing' : null
}

const handleSettingsClick = () => {
  loadCurrentSettings()
  isSettingsModalOpen.value = true
}

const closeSettingsModal = () => {
  isSettingsModalOpen.value = false
}

const saveSettings = () => {
  // Save settings to localStorage
  localStorage.setItem('ftw-search-settings', JSON.stringify(settings.value))

  // Update the form inputs with the new settings
  const startDateInput = document.getElementById('start-date') as HTMLInputElement
  const endDateInput = document.getElementById('end-date') as HTMLInputElement
  const cloudCoverInput = document.getElementById('cloud-cover') as HTMLInputElement
  const areaCoverageInput = document.getElementById('area-coverage') as HTMLInputElement

  if (startDateInput) startDateInput.value = settings.value.startDate
  if (endDateInput) endDateInput.value = settings.value.endDate
  if (cloudCoverInput) cloudCoverInput.value = settings.value.cloudCover.toString()
  if (areaCoverageInput) areaCoverageInput.value = settings.value.areaCoverage.toString()

  closeSettingsModal()
}

const updateCloudCoverInput = () => {
  // Ensure the value is a number
  settings.value.cloudCover = Number(settings.value.cloudCover)
}

const updateCloudCoverSlider = () => {
  // Ensure the value is a number
  settings.value.cloudCover = Number(settings.value.cloudCover)
}

const updateAreaCoverageInput = () => {
  // Ensure the value is a number
  settings.value.areaCoverage = Number(settings.value.areaCoverage)
}

const updateAreaCoverageSlider = () => {
  // Ensure the value is a number
  settings.value.areaCoverage = Number(settings.value.areaCoverage)
}

const loadCurrentSettings = () => {
  // Load current values from the form inputs and update settings
  const startDateInput = document.getElementById('start-date') as HTMLInputElement
  const endDateInput = document.getElementById('end-date') as HTMLInputElement
  const cloudCoverInput = document.getElementById('cloud-cover') as HTMLInputElement
  const areaCoverageInput = document.getElementById('area-coverage') as HTMLInputElement

  // Update settings with current form values (if they exist) or keep stored values
  settings.value.startDate = startDateInput?.value || settings.value.startDate
  settings.value.endDate = endDateInput?.value || settings.value.endDate
  settings.value.cloudCover = Number(cloudCoverInput?.value) || settings.value.cloudCover
  settings.value.areaCoverage = Number(areaCoverageInput?.value) || settings.value.areaCoverage
}

// Expose methods to parent components
defineExpose({
  handleSearchResults: (mgrsTileId: string, bbox?: number[]) =>
    batchProcessingRef.value?.handleSearchResults(mgrsTileId, bbox, settings.value),
  setDrawnExtent: (extent: Extent) => batchProcessingRef.value?.setDrawnExtent(extent),
  currentMgrsTileId: batchProcessingRef.value?.currentMgrsTileId,
  handleBboxSizeWarning: (message: string) =>
    batchProcessingRef.value?.handleBboxSizeWarning(message),
  handleBatchProcessingToggle: (isOpen: boolean) => handleBatchProcessingToggle(isOpen),
})
</script>

<template>
  <div class="data-cabinet">
    <div class="header-container">
      <h2>Fields of the World: Inference App</h2>
      <button class="settings-button" @click="handleSettingsClick" title="Settings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.49,0-0.61,0.22L2.62,8.87 C2.52,9.08,2.57,9.34,2.75,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.49,0,0.61-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"
          />
        </svg>
      </button>
    </div>
    <SmallAreaProcessing
      v-if="props.map"
      :is-open="activeAccordion === 'smallAreaProcessing'"
      @update:is-open="handleSmallAreaProcessingToggle"
      :map="props.map"
    />
    <BatchProcessing
      v-if="props.map"
      :map="props.map"
      :is-open="activeAccordion === 'batchProcessing'"
      @update:is-open="handleBatchProcessingToggle"
      ref="batchProcessingRef"
    />

    <!-- Settings Modal -->
    <div v-if="isSettingsModalOpen" class="modal-overlay" @click="closeSettingsModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Search Settings</h3>
          <button class="close-button" @click="closeSettingsModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="settings-start-date">Start Date</label>
            <input
              id="settings-start-date"
              type="date"
              v-model="settings.startDate"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="settings-end-date">End Date</label>
            <input
              id="settings-end-date"
              type="date"
              v-model="settings.endDate"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="settings-cloud-cover">Cloud Cover (%)</label>
            <div class="slider-container">
              <input
                id="settings-cloud-cover"
                type="range"
                v-model="settings.cloudCover"
                min="0"
                max="100"
                step="1"
                class="slider"
                @input="updateCloudCoverInput"
              />
              <input
                type="number"
                v-model="settings.cloudCover"
                min="0"
                max="100"
                class="slider-input"
                @input="updateCloudCoverSlider"
              />
            </div>
          </div>
          <div class="form-group">
            <label for="settings-area-coverage">Area Coverage (%)</label>
            <div class="slider-container">
              <input
                id="settings-area-coverage"
                type="range"
                v-model="settings.areaCoverage"
                min="0"
                max="100"
                step="1"
                class="slider"
                @input="updateAreaCoverageInput"
              />
              <input
                type="number"
                v-model="settings.areaCoverage"
                min="0"
                max="100"
                class="slider-input"
                @input="updateAreaCoverageSlider"
              />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeSettingsModal">Cancel</button>
          <button class="btn btn-primary" @click="saveSettings">Save Settings</button>
        </div>
      </div>
    </div>
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

.settings-button {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
}

.settings-button:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.1);
}

.settings-button:active {
  transform: scale(0.95);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background-color: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(0, 136, 136, 0.8);
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  color: white;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: white;
}

.modal-header .close-button {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.modal-header .close-button:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.1);
}

.modal-body {
  padding: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: rgba(0, 136, 136, 0.8);
  background-color: rgba(255, 255, 255, 0.15);
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: rgba(0, 136, 136, 0.8);
  color: white;
}

.btn-primary:hover {
  background-color: rgba(0, 136, 136, 1);
}

.btn-secondary {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
}

.btn-secondary:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

/* Slider Styles */
.slider-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 136, 136, 0.8);
  cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.8);
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  background: rgba(0, 136, 136, 1);
  transform: scale(1.1);
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 136, 136, 0.8);
  cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.8);
  transition: all 0.2s ease;
}

.slider::-moz-range-thumb:hover {
  background: rgba(0, 136, 136, 1);
  transform: scale(1.1);
}

.slider-input {
  width: 80px;
  padding: 0.5rem;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  font-size: 0.875rem;
  text-align: center;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.slider-input:focus {
  outline: none;
  border-color: rgba(0, 136, 136, 0.8);
  background-color: rgba(255, 255, 255, 0.15);
}

.slider-input::-webkit-outer-spin-button,
.slider-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.slider-input[type='number'] {
  -moz-appearance: textfield;
}
</style>
