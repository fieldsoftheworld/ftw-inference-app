import { ref, watch } from 'vue'

export interface Settings {
  startDate: string
  endDate: string
  cloudCover: number
  areaCoverage: number
  selectedCollection: string[]
}

const availableCollections = [['sentinel-2-c1-l2a'], ['sentinel-2-l2a']]

// Default settings
const defaultSettings: Settings = {
  startDate: '',
  endDate: '',
  cloudCover: 10,
  areaCoverage: 60,
  selectedCollection: availableCollections[0],
}

export const loadSettingsFromStorage = (): Settings => {
  const stored = localStorage.getItem('ftw-search-settings')
  if (stored) {
    const parsed = JSON.parse(stored)
    return {
      startDate: parsed.startDate || defaultSettings.startDate,
      endDate: parsed.endDate || defaultSettings.endDate,
      cloudCover: parsed.cloudCover || defaultSettings.cloudCover,
      areaCoverage: parsed.areaCoverage || defaultSettings.areaCoverage,
      selectedCollection: parsed.selectedCollection || defaultSettings.selectedCollection,
    }
  }

  return { ...defaultSettings }
}

const saveSettingsToStorage = (settings: Settings) => {
  localStorage.setItem('ftw-search-settings', JSON.stringify(settings))
}

const settings = ref<Settings>(loadSettingsFromStorage())

// Callback for when settings change
let onSettingsChange: ((newSettings: Settings) => void) | null = null

const updateSettings = (newSettings: Settings) => {
  settings.value = { ...newSettings }
  saveSettingsToStorage(newSettings)
}

// Watch for settings changes and trigger callback
watch(
  settings,
  (newSettings) => {
    if (onSettingsChange) {
      onSettingsChange(newSettings)
    }
  },
  { deep: true },
)

const resetSettings = () => {
  updateSettings({ ...defaultSettings })
}

// Function to set the callback for settings changes
const setOnSettingsChange = (callback: (newSettings: Settings) => void) => {
  onSettingsChange = callback
}

// Function to get settings for search API
const getSearchSettings = () => {
  return {
    startDate: settings.value.startDate,
    endDate: settings.value.endDate,
    cloudCover: settings.value.cloudCover,
    areaCoverage: settings.value.areaCoverage,
    selectedCollection: settings.value.selectedCollection,
  }
}

export function useSettings() {
  return {
    settings,
    availableCollections,
    defaultSettings,
    updateSettings,
    resetSettings,
    setOnSettingsChange,
    getSearchSettings,
    loadSettingsFromStorage,
    saveSettingsToStorage,
  }
}
