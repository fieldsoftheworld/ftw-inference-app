import { ref, watch } from 'vue'
import { currentMgrsTileId } from './useAreaOfInterest'
import { currentBbox, handleSearchResults } from './useSearch'

export interface Settings {
  startDate: string
  endDate: string
  cloudCover: number
  areaCoverage: number
  selectedCollection: string[]
  selectedModel: string
}

const collections = {
  'sentinel-2-c1-l2a': 'Sentinel-2 Level 2A, Collection 1',
  'sentinel-2-l2a': 'Sentinel-2 Level 2A, Legacy',
}
const availableCollections: [keyof typeof collections][] = Object.keys(collections).map((c) => [
  c,
]) as [keyof typeof collections][]

const availableModels = ref<{ id: string; title: string }[]>([])

// Default settings
export const defaultSettings: Settings = {
  startDate: '',
  endDate: '',
  cloudCover: 20,
  areaCoverage: 60,
  selectedCollection: availableCollections[0],
  selectedModel: '3_Class_FULL_FTW_Pretrained',
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
export const sceneYear = ref<number>(new Date().getFullYear() - 1)

// Function to set available models from API response
export const setAvailableModels = (modelsData: { id: string; title?: string }[]) => {
  const modelsMap: { id: string; title: string }[] = []

  modelsData.forEach((model) => {
    const modelId = model.id
    const modelTitle = model.title || modelId
    modelsMap.push({ id: modelId, title: modelTitle })
  })

  availableModels.value = modelsMap

  // Set default model if none is selected and models are available
  if (!settings.value.selectedModel && modelsMap.length > 0) {
    settings.value.selectedModel = modelsMap[0].id
  }
}

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
    availableModels,
    defaultSettings,
    loadSettingsFromStorage,
    setAvailableModels,
  }
}
