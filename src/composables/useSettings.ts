import { ref, watch } from 'vue'
import { currentBbox, handleSearchResults } from './useSearch'
import { currentMgrsTileId } from './useAreaOfInterest'

export interface Settings {
  startDate: string
  endDate: string
  cloudCover: number
  areaCoverage: number
  selectedCollection: string[]
}

const collections = {
  'sentinel-2-c1-l2a': 'Sentinel-2 Level 2A, Collection 1',
  'sentinel-2-l2a': 'Sentinel-2 Level 2A, Legacy',
}
const availableCollections: [keyof typeof collections][] = Object.keys(collections).map((c) => [
  c,
]) as [keyof typeof collections][]

// Default settings
export const defaultSettings: Settings = {
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
    return Object.assign(structuredClone(defaultSettings), parsed) as Settings
  }

  return structuredClone(defaultSettings)
}

const settings = ref<Settings>(loadSettingsFromStorage())
export const autoSceneSelection = ref(true)
export const sceneYear = ref<number>(new Date().getFullYear())

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
    autoSceneSelection,
    sceneYear,
    collections,
    availableCollections,
    defaultSettings,
    loadSettingsFromStorage,
  }
}
