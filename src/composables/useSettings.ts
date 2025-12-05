import { computed, ref, watch, shallowRef } from 'vue'

export interface Settings {
  autoSceneSelection: boolean
  year: number
  startMonth: number
  endMonth: number
  cloudCover: number
  areaCoverage: number
  buffer: number
  model: string
  expertMode: boolean
}

export interface ProcessingSettings {
  inference_resize_factor: number
  inference_patch_size: number | null
  inference_padding: number | null
  polygons_simplify: number
  polygons_min_size: number
  polygons_close_interiors: boolean
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
  model: '',
  expertMode: false,
}

// Default processing settings
const defaultProcessingSettings: ProcessingSettings = {
  inference_resize_factor: 2,
  inference_patch_size: null,
  inference_padding: null,
  polygons_simplify: 15,
  polygons_min_size: 500,
  polygons_close_interiors: false,
}

function filterProcessingSettings(prefix: string) {
  const data = {}
  for (const key in processingSettings.value) {
    if (key.startsWith(prefix)) {
      const value = (processingSettings.value as any)[key]
      if (value !== (defaultProcessingSettings as any)[key]) {
        ;(data as any)[key.substring(prefix.length)] = value
      }
    }
  }
  return data
}

const inferenceSettings = computed(() => filterProcessingSettings('inference_'))

const polygonizationSettings = computed(() => filterProcessingSettings('polygons_'))

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

const loadSettingsFromStorage = (key: string, defaults: object): object => {
  const stored = localStorage.getItem(key)
  if (stored) {
    const parsed = JSON.parse(stored)
    return Object.assign(structuredClone(defaults), parsed)
  }

  return structuredClone(defaults)
}

const settings = ref<Settings>(
  loadSettingsFromStorage('ftw-search-settings', defaultSettings) as Settings,
)
const processingSettings = ref<ProcessingSettings>(
  loadSettingsFromStorage(
    'ftw-processing-settings',
    defaultProcessingSettings,
  ) as ProcessingSettings,
)

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

watch(
  processingSettings,
  (newProcessingSettings) => {
    localStorage.setItem('ftw-processing-settings', JSON.stringify(newProcessingSettings))
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
    processingSettings,
    inferenceSettings,
    polygonizationSettings,
    availableModels,
    defaultSettings,
    defaultProcessingSettings,
    defaultModel,
    loadSettingsFromStorage,
    setAvailableModels,
    modelIsSingleShot,
  }
}
