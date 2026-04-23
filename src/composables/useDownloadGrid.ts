import { shallowRef, watch } from 'vue'
import type Map from 'ol/Map'
import type VectorLayer from 'ol/layer/Vector'
import type VectorSource from 'ol/source/Vector'
import type { FeatureLike } from 'ol/Feature'
import { createDownloadGridLayer, getDownloadParquetUrl } from '../layers/Download-Grid-Layer'
import useSettings from './useSettings'

export interface GridCell {
  tile_id: string
  lat_min: number
  lon_min: number
  years: number[]
  // Per-year dicts keyed by year-as-string (e.g. "2024", "2025"), as served by
  // the v2 manifest. Absent years are simply missing keys.
  feature_counts?: Record<string, number>
  size_bytes?: Record<string, number>
}

const { settings } = useSettings()

// Singleton state shared by all consumers of the composable.
const hoveredGridFeature = shallowRef<FeatureLike | null>(null)
const downloadGridLayer = shallowRef<VectorLayer<VectorSource> | null>(null)
const currentMap = shallowRef<Map | null>(null)

const DOWNLOAD_GRID_MAX_ZOOM = 8

// Track maps we've already wired up so we don't register duplicate listeners.
const initializedMaps = new WeakSet<Map>()

/** Narrow an unknown value to a year-keyed dict of numbers. */
function toNumericYearDict(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'number') out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Convert an OL feature from the grid layer into our GridCell DTO. */
export function featureToGridCell(feature: FeatureLike): GridCell {
  const props = feature.getProperties()
  return {
    tile_id: props.tile_id ?? String(feature.getId() ?? ''),
    lat_min: typeof props.lat_min === 'number' ? props.lat_min : 0,
    lon_min: typeof props.lon_min === 'number' ? props.lon_min : 0,
    years: Array.isArray(props.years) ? props.years : [],
    feature_counts: toNumericYearDict(props.feature_counts),
    size_bytes: toNumericYearDict(props.size_bytes),
  }
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  // This doesn't actually set the filename as we download from another host,
  // so browsers block providing a custom name (CORS same-origin policy).
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function ensureDownloadGridVisibleAtUsableZoom(map: Map | null) {
  if (!map || !settings.value.downloads) return

  const view = map.getView()
  const zoom = view.getZoom()
  if (zoom !== undefined && zoom > DOWNLOAD_GRID_MAX_ZOOM) {
    view.animate({
      zoom: DOWNLOAD_GRID_MAX_ZOOM,
    })
  }
}

// Toggle layer visibility and clear hover state when the grid is turned off.
watch(
  () => settings.value.downloads,
  (visible) => {
    downloadGridLayer.value?.setVisible(visible)
    if (visible) {
      ensureDownloadGridVisibleAtUsableZoom(currentMap.value)
    } else {
      hoveredGridFeature.value = null
      downloadGridLayer.value?.changed()
      const el = currentMap.value?.getTargetElement()
      if (el) el.style.cursor = ''
    }
  },
)

// The download grid is only meaningful in global mode; turn it off otherwise.
watch(
  () => settings.value.mode,
  (mode) => {
    if (mode !== 'global') settings.value.downloads = false
  },
)

export default function useDownloadGrid() {
  /** Idempotent: creates the layer and registers listeners on first call per map. */
  const initDownloadGridLayer = (map: Map) => {
    if (initializedMaps.has(map)) return
    initializedMaps.add(map)
    currentMap.value = map

    const layer = createDownloadGridLayer(hoveredGridFeature)
    downloadGridLayer.value = layer
    map.addLayer(layer)
    layer.setVisible(settings.value.downloads)
    ensureDownloadGridVisibleAtUsableZoom(map)

    map.on('pointermove', (event) => {
      if (!settings.value.downloads) return
      const feature =
        map.forEachFeatureAtPixel(event.pixel, (f) => f, {
          layerFilter: (l) => l === layer,
        }) ?? null
      if (feature !== hoveredGridFeature.value) {
        hoveredGridFeature.value = feature
        layer.changed()
        map.getTargetElement().style.cursor = feature ? 'pointer' : ''
      }
    })
  }

  /** Handle a map click; returns true if it hit a grid cell. */
  const handleGridClick = (map: Map, pixel: number[]): boolean => {
    const layer = downloadGridLayer.value
    if (!settings.value.downloads || !layer) return false
    const feature =
      map.forEachFeatureAtPixel(pixel, (f) => f, {
        layerFilter: (l) => l === layer,
      }) ?? null
    if (!feature) return false

    const selectedGridCell = featureToGridCell(feature)
    if (!selectedGridCell.years.includes(settings.value.year)) {
      return true
    }

    const url = getDownloadParquetUrl(settings.value.year, selectedGridCell.tile_id)
    triggerDownload(url, `ftw-fields-${selectedGridCell.tile_id}-${settings.value.year}.parquet`)
    return true
  }

  return {
    downloadGridLayer,
    initDownloadGridLayer,
    handleGridClick,
  }
}
