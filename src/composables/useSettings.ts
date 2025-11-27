import { computed, ref, watch, shallowRef } from 'vue'

export interface Settings {
  autoSceneSelection: boolean
  year: number
  startMonth: number
  endMonth: number
  cloudCover: number
  areaCoverage: number
  buffer: number
  collection: string[]
  model: string
  expertMode: boolean
}

export interface ModelInfo {
  id: string
  title: string
  description?: string
  requires_window?: boolean
  version?: string
  license?: string
  legacy?: boolean
  default?: boolean
}

const collections: Record<string, string> = {
  'sentinel-2-c1-l2a': 'Sentinel-2 Level 2A, Collection 1',
  'sentinel-2-l2a': 'Sentinel-2 Level 2A, Legacy',
}
const availableCollections: [keyof typeof collections][] = Object.keys(collections).map((c) => [
  c,
]) as [keyof typeof collections][]

const availableModels = shallowRef<ModelInfo[]>([])

// Default settings
const defaultSettings: Settings = {
  autoSceneSelection: true,
  year: new Date().getFullYear() - 1,
  startMonth: 0,
  endMonth: 0,
  cloudCover: 20,
  areaCoverage: 60,
  buffer: 14,
  collection: availableCollections[0],
  model: '',
  expertMode: false,
}

const defaultModel = computed(() => {
  let selected = availableModels.value.find((m) => m.default)
  if (!selected && availableModels.value.length > 0) {
    selected = availableModels.value[0]
  }
  return selected?.id || ''
})

watch(defaultModel, () => {
  if (defaultModel.value && !settings.value.model) {
    settings.value.model = defaultModel.value
  }
})

const loadSettingsFromStorage = (): Settings => {
  const stored = localStorage.getItem('ftw-search-settings')
  if (stored) {
    const parsed = JSON.parse(stored)
    return Object.assign(structuredClone(defaultSettings), parsed) as Settings
  }

  return structuredClone(defaultSettings)
}

const settings = ref<Settings>(loadSettingsFromStorage())

// Function to set available models from API response
const setAvailableModels = (modelsData: ModelInfo[]) => {
  const modelsMap: ModelInfo[] = []

  modelsData.forEach((model) => {
    modelsMap.push({
      id: model.id,
      title: model.title || model.id,
      description: model.description,
      requires_window: model.requires_window,
      version: model.version,
      license: model.license,
      legacy: model.legacy || false,
      default: model.default || false,
    })
  })
  modelsMap.sort((a, b) => {
    // Default models first
    if (a.default && !b.default) return -1
    // Then sort by legacy status (non-legacy first)
    if (a.legacy && !b.legacy) return 1
    if (!a.legacy && b.legacy) return -1
    // Then by version (newest first)
    // only works if the version strings are comparable, assumes "v\d" format
    const v = b.version?.localeCompare(a.version || '')
    if (v) return v
    // Finally alphabetically
    return a.title.localeCompare(b.title)
  })

  availableModels.value = modelsMap

  // If an old model is stored in localStorage, reset to default model
  if (settings.value.model && !modelsMap.find((m) => m.id === settings.value.model)) {
    settings.value.model = defaultModel.value
  }
}

// Watch for settings changes and store locally
watch(
  settings,
  (newSettings) => {
    localStorage.setItem('ftw-search-settings', JSON.stringify(newSettings))
  },
  { deep: true },
)

const modelIsSingleShot = computed(() => {
  const model = availableModels.value.find((m) => m.id === settings.value.model)
  return model?.requires_window === false
})

export default function useSettings() {
  return {
    settings,
    collections,
    availableCollections,
    availableModels,
    defaultSettings,
    defaultModel,
    loadSettingsFromStorage,
    setAvailableModels,
    modelIsSingleShot,
  }
}
