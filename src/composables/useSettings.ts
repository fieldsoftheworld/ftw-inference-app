import { computed, ref, watch } from 'vue'
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

export interface ModelInfo {
  id: string
  title: string
  description?: string
  requires_window?: boolean
  version?: string
  license?: string
}

const collections = {
  'sentinel-2-c1-l2a': 'Sentinel-2 Level 2A, Collection 1',
  'sentinel-2-l2a': 'Sentinel-2 Level 2A, Legacy',
}
const availableCollections: [keyof typeof collections][] = Object.keys(collections).map((c) => [
  c,
]) as [keyof typeof collections][]

const availableModels = ref<ModelInfo[]>([])

// Default settings
export const defaultSettings: Settings = {
  startDate: '',
  endDate: '',
  cloudCover: 20,
  areaCoverage: 60,
  selectedCollection: availableCollections[0],
  selectedModel: '3_Class_FULL_multiWindow_v2',
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
export const setAvailableModels = (modelsData: ModelInfo[]) => {
  const modelsMap: ModelInfo[] = []

  modelsData.forEach((model) => {
    modelsMap.push({
      id: model.id,
      title: model.title || model.id,
      description: model.description,
      requires_window: model.requires_window,
      version: model.version,
      license: model.license,
    })
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

const modelIsSingleShot = computed(() => {
  const model = availableModels.value.find((m) => m.id === settings.value.selectedModel)
  return model?.requires_window === false
})

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
    modelIsSingleShot,
  }
}
