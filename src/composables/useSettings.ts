import { ref, watch } from 'vue'
import { useSearch } from './useSearch'
import { useAreaOfInterest } from './useAreaOfInterest'

export interface Settings {
  startDate: string
  endDate: string
  cloudCover: number
  areaCoverage: number
  selectedCollection: string[]
}

const availableCollections = [['sentinel-2-c1-l2a'], ['sentinel-2-l2a']]

const { currentBbox, handleSearchResults } = useSearch()
const { currentMgrsTileId } = useAreaOfInterest()

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

const settings = ref<Settings>(loadSettingsFromStorage())

// Watch for settings changes and trigger search refresh
watch(
  settings,
  (newSettings) => {
    localStorage.setItem('ftw-search-settings', JSON.stringify(newSettings))
    if (currentBbox.value && currentMgrsTileId.value) {
      handleSearchResults(currentMgrsTileId.value, currentBbox.value, newSettings)
    }
  },
  { deep: true },
)

export function useSettings() {
  return {
    settings,
    availableCollections,
    defaultSettings,
    loadSettingsFromStorage,
  }
}
