<script setup lang="ts">
import { ref } from 'vue'

interface Settings {
  startDate: string
  endDate: string
  cloudCover: number
  areaCoverage: number
  selectedCollection: string[]
}

const availableCollections = [['sentinel-2-c1-l2a'], ['sentinel-2-l2a']]

const props = defineProps<{
  isOpen: boolean
  initialSettings: Settings
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
  (e: 'save', settings: Settings): void
}>()

const settings = ref({ ...props.initialSettings })
const originalSettings = ref({ ...props.initialSettings })

const closeModal = () => {
  emit('update:isOpen', false)
}

const saveSettings = () => {
  // Save settings to localStorage
  localStorage.setItem('ftw-search-settings', JSON.stringify(settings.value))

  emit('save', settings.value)
  closeModal()
}

const updateCloudCoverInput = () => {
  // Ensure the value is a number
  settings.value.cloudCover = Number(settings.value.cloudCover)
  checkCloudCoverWarning()
}

const updateCloudCoverSlider = () => {
  // Ensure the value is a number
  settings.value.cloudCover = Number(settings.value.cloudCover)
  checkCloudCoverWarning()
}

const checkCloudCoverWarning = () => {
  if (settings.value.cloudCover > 50) {
    // Show warning in the modal
    const warningElement = document.getElementById('cloud-cover-warning')
    if (warningElement) {
      warningElement.style.display = 'block'
    }
  } else {
    // Hide warning
    const warningElement = document.getElementById('cloud-cover-warning')
    if (warningElement) {
      warningElement.style.display = 'none'
    }
  }
}

const updateAreaCoverageInput = () => {
  // Ensure the value is a number
  settings.value.areaCoverage = Number(settings.value.areaCoverage)
}

const updateAreaCoverageSlider = () => {
  // Ensure the value is a number
  settings.value.areaCoverage = Number(settings.value.areaCoverage)
}

const clearDateFilters = () => {
  settings.value.startDate = ''
  settings.value.endDate = ''
}

const resetToDefaults = () => {
  settings.value.startDate = ''
  settings.value.endDate = ''
  settings.value.cloudCover = 10
  settings.value.areaCoverage = 60
  settings.value.selectedCollection = availableCollections[0]
  checkCloudCoverWarning()
}

const cancelChanges = () => {
  // Restore original settings
  settings.value = { ...originalSettings.value }
  closeModal()
}

// Initialize settings when modal opens
const initializeSettings = () => {
  if (props.isOpen) {
    settings.value = { ...props.initialSettings }
    originalSettings.value = { ...props.initialSettings }
    // Check for warnings after modal opens
    setTimeout(() => {
      checkCloudCoverWarning()
    }, 100)
  }
}

// Watch for modal open state
import { watch } from 'vue'
watch(() => props.isOpen, initializeSettings)
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Search Settings</h3>
        <button class="close-button" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Data Collection</label>
          <div class="radio-group">
            <label
              v-for="collection in availableCollections"
              :key="collection[0]"
              class="radio-option"
            >
              <input
                type="radio"
                :value="collection"
                v-model="settings.selectedCollection"
                class="radio-input"
              />
              <span class="radio-label">{{ collection[0] }}</span>
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>Date Range</label>
          <div class="date-range-container">
            <div class="date-input-group">
              <label for="settings-start-date" class="date-label">Start Date</label>
              <input
                id="settings-start-date"
                type="month"
                v-model="settings.startDate"
                class="form-input date-input"
              />
            </div>
            <div class="date-input-group">
              <label for="settings-end-date" class="date-label">End Date</label>
              <input
                id="settings-end-date"
                type="month"
                v-model="settings.endDate"
                class="form-input date-input"
              />
            </div>
          </div>
          <div class="filter-actions">
            <button class="btn btn-secondary btn-small" @click="clearDateFilters">
              Clear Dates
            </button>
          </div>
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
          <div id="cloud-cover-warning" class="warning-message" style="display: none">
            ⚠️ Warning: Cloud cover above 50% may decrease the probability of getting accurate
            results. Try to select an area without clouds.
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
        <button class="btn btn-secondary" @click="cancelChanges">Cancel</button>
        <button class="btn btn-secondary" @click="resetToDefaults">Reset</button>
        <button class="btn btn-primary" @click="saveSettings">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  max-width: 415px;
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
  display: flex;
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

/* Make calendar icon white for date inputs */
.form-input[type='date']::-webkit-calendar-picker-indicator,
.form-input[type='month']::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}

.form-input[type='date']::-webkit-inner-spin-button,
.form-input[type='date']::-webkit-outer-spin-button,
.form-input[type='month']::-webkit-inner-spin-button,
.form-input[type='month']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
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
  appearance: textfield;
}

.warning-message {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 4px;
  color: #ffc107;
  font-size: 0.875rem;
  font-weight: 500;
  display: none;
}

/* Date Range Styles */
.date-range-container {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.date-input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.date-label {
  display: block;
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.75rem;
  font-weight: 500;
}

.date-input {
  width: 100%;
  color-scheme: light;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
}

/* Radio Group Styles */
.radio-group {
  display: flex;
  gap: 1.25rem;
}

.radio-option {
  display: flex;
  align-items: center;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.radio-option:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.radio-input {
  margin: 0;
  margin-right: 0.5rem;
  width: 16px;
  height: 16px;
  accent-color: rgba(0, 136, 136, 0.8);
  cursor: pointer;
}

.radio-label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
}
</style>
