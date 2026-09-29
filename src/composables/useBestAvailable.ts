import { computed, ref, shallowRef, watch } from 'vue'
import type VectorTileLayer from 'ol/layer/VectorTile'
import { transformExtent } from 'ol/proj'
import { map } from './useMap'
import useSettings, { GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL } from './useSettings'
import index from '../data/best-available.json'
import {
  applyColor,
  colorFor,
  createBestAvailableLayer,
  PALETTE,
} from '../layers/Best-Available-Layer'

export interface BestAvailableCollection {
  id: string
  title: string
  holds: 'fields' | 'blocks'
  /** west, south, east, north in EPSG:4326 */
  bbox: [number, number, number, number]
  year: number
  editions: number
  provider: string
  license: string
  pmtiles: string
  providerUrl: string | null
  catalogUrl: string
}

const COLLECTIONS = (index.collections as BestAvailableCollection[]).slice().sort((a, b) => {
  if (a.holds !== b.holds) return a.holds === 'fields' ? -1 : 1
  return a.title.localeCompare(b.title)
})
const POSITIONS = new Map(COLLECTIONS.map((c, i) => [c.id, i]))
const COLOR_KEY = 'ftw.bestAvailable.colors'

const { settings } = useSettings()
const inView = ref<BestAvailableCollection[]>([])
const zoom = ref(0)
const enabled = ref<Set<string>>(new Set())
const showBlocks = ref(false)
const layers = shallowRef(new Map<string, VectorTileLayer>())
const featureCounts = ref<Record<string, number>>({})
const overrides = ref<Record<string, string>>(readColors())

function readColors(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(COLOR_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function overlaps(bbox: BestAvailableCollection['bbox'], view: number[]): boolean {
  return bbox[0] < view[2] && bbox[2] > view[0] && bbox[1] < view[3] && bbox[3] > view[1]
}

export function refreshInView() {
  const view = map.value?.getView()
  const extent = view && map.value ? view.calculateExtent(map.value.getSize()) : null
  zoom.value = view?.getZoom() ?? 0
  featureCounts.value = {}
  if (!extent) {
    inView.value = []
    return
  }
  const bounds = transformExtent(extent, 'EPSG:3857', 'EPSG:4326')
  inView.value = COLLECTIONS.filter((c) => overlaps(c.bbox, bounds))
}

/** Below the field zoom everything overlaps, so the list would say nothing useful. */
const tooFarOut = computed(() => zoom.value < GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL)

const visible = computed(() =>
  tooFarOut.value ? [] : inView.value.filter((c) => showBlocks.value || c.holds === 'fields'),
)

const blocksAvailable = computed(
  () => !tooFarOut.value && inView.value.some((c) => c.holds === 'blocks'),
)

export function colorOf(collection: BestAvailableCollection): string {
  return overrides.value[collection.id] ?? colorFor(POSITIONS.get(collection.id) ?? 0)
}

export function setColor(collection: BestAvailableCollection, color: string) {
  overrides.value = { ...overrides.value, [collection.id]: color }
  try {
    localStorage.setItem(COLOR_KEY, JSON.stringify(overrides.value))
  } catch {
    // storage blocked: the colour still applies for this session
  }
  const layer = layers.value.get(collection.id)
  if (layer) applyColor(layer, color)
}

/** A bbox covers ground its data does not, so report what actually drew here. */
export function coverageOf(collection: BestAvailableCollection): 'unknown' | 'none' | 'some' {
  if (!enabled.value.has(collection.id)) return 'unknown'
  const n = featureCounts.value[collection.id]
  return n === undefined ? 'unknown' : n > 0 ? 'some' : 'none'
}

function addLayer(collection: BestAvailableCollection) {
  if (!map.value || layers.value.has(collection.id)) return
  const layer = createBestAvailableLayer(collection, colorOf(collection))
  layer.getSource()?.on('tileloadend', (event) => {
    const { tile } = event as unknown as { tile: { getFeatures?: () => unknown[] } }
    const seen = featureCounts.value[collection.id] ?? 0
    featureCounts.value = {
      ...featureCounts.value,
      [collection.id]: seen + (tile.getFeatures?.()?.length ?? 0),
    }
  })
  map.value.addLayer(layer)
  layers.value.set(collection.id, layer)
}

function removeLayer(id: string) {
  const layer = layers.value.get(id)
  if (!layer) return
  map.value?.removeLayer(layer)
  layer.getSource()?.clear()
  layers.value.delete(id)
  const { [id]: _gone, ...rest } = featureCounts.value
  featureCounts.value = rest
}

export function toggle(collection: BestAvailableCollection) {
  const next = new Set(enabled.value)
  if (next.has(collection.id)) {
    next.delete(collection.id)
    removeLayer(collection.id)
  } else {
    next.add(collection.id)
    addLayer(collection)
  }
  enabled.value = next
}

export function removeAllLayers() {
  for (const id of [...layers.value.keys()]) removeLayer(id)
}

// The panel can mount before the map exists, so wait for it rather than assume.
watch(
  map,
  (instance) => {
    if (!instance) return
    instance.on('moveend', refreshInView)
    refreshInView()
  },
  { immediate: true },
)

// These layers belong to global mode; custom mode tears everything else down too.
watch(
  () => settings.value.mode,
  (mode) => {
    if (mode !== 'global') removeAllLayers()
    else for (const c of visible.value) if (enabled.value.has(c.id)) addLayer(c)
  },
)

// Enabled collections stay enabled off-screen but only fetch tiles while in view.
watch(visible, (now) => {
  const here = new Set(now.map((c) => c.id))
  for (const id of [...layers.value.keys()]) if (!here.has(id)) removeLayer(id)
  for (const c of now) if (enabled.value.has(c.id)) addLayer(c)
})

export default function useBestAvailable() {
  return {
    collections: visible,
    blocksAvailable,
    tooFarOut,
    enabled,
    showBlocks,
    palette: PALETTE,
    toggle,
    colorOf,
    setColor,
    coverageOf,
    refreshInView,
    removeAllLayers,
  }
}
