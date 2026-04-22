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
  mode: string
  threshold: number
  fieldBoundariesOpacity: number
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

const defaultMode = 'global'

const availableModes: { id: string; label: string }[] = [
  {
    id: 'global',
    label: 'Global',
  },
  {
    id: 'inference',
    label: 'Custom',
  },
  // {
  //   id: 'edit',
  //   label: 'Editing',
  // },
]

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
  mode: defaultMode,
  threshold: 0.4,
  fieldBoundariesOpacity: 90,
}

const defaultModel = computed(() => {
  let selected = availableModels.value.find((m) => m.default)
  if (!selected && availableModels.value.length > 0) {
    selected = availableModels.value[0]
  }
  return selected?.id || ''
})

const defaultYearGlobal = 2025

const modelTitle = computed(() => {
  const model = settings.value.model
  return model ? availableModels.value.find((m) => m.id === model)?.title || null : null
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

watch(
  () => settings.value.mode,
  () => {
    if (
      settings.value.mode === 'global' &&
      (settings.value.year < 2024 || settings.value.year > 2025)
    ) {
      settings.value.year = defaultYearGlobal
    }
  },
)

const modelIsSingleShot = computed(() => {
  const model = availableModels.value.find((m) => m.id === settings.value.model)
  return model?.requires_window === false
})

export const GLOBAL_DATA_PMTILES_THRESHOLD_METRIC = 'mean' // median / mean / min
export const GLOBAL_DATA_MAP_COMPLETE_ZOOM_LEVEL = 12
export const GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL = 11
export const get_global_pmtiles_url = (year: number) => {
  return `https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/ftw/global-field-boundaries/pmtiles/ftw-global-fields-${year}.pmtiles`
}

export const AREA_OVERVIEW_COG =
  'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/m-mohr/ftw-confidence-layers/prue_v1_field_area_500m_fieldsonly_uint8_3857.tif'
export const CONFIDENCE_OVERVIEW_COG =
  'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/m-mohr/ftw-confidence-layers/prue_v1_confidence_global_uint8_3857.tif'

export default function useSettings() {
  return {
    settings,
    availableModels,
    defaultMode,
    availableModes,
    defaultSettings,
    defaultModel,
    modelTitle,
    loadSettingsFromStorage,
    setAvailableModels,
    modelIsSingleShot,
  }
}
