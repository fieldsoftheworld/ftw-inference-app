import { ref, shallowRef, watch } from 'vue'
import type Map from 'ol/Map'
import type VectorLayer from 'ol/layer/Vector'
import type VectorSource from 'ol/source/Vector'
import type { FeatureLike } from 'ol/Feature'
import { createDownloadGridLayer } from '../layers/Download-Grid-Layer'
import useSettings from './useSettings'

export interface GridCell {
  tile_id: string
  lat_min: number
  lon_min: number
  years: number[]
  feature_count?: number
  size_bytes?: number
}

const { settings } = useSettings()

// Singleton state shared by all consumers of the composable.
const showDownloadModal = ref(false)
const selectedGridCell = ref<GridCell | null>(null)

const hoveredGridFeature = shallowRef<FeatureLike | null>(null)
const selectedGridFeature = shallowRef<FeatureLike | null>(null)
const downloadGridLayer = shallowRef<VectorLayer<VectorSource> | null>(null)

// Track maps we've already wired up so we don't register duplicate listeners.
const initializedMaps = new WeakSet<Map>()

/** Convert an OL feature from the grid layer into our GridCell DTO. */
export function featureToGridCell(feature: FeatureLike): GridCell {
  const props = feature.getProperties()
  return {
    tile_id: props.tile_id ?? String(feature.getId() ?? ''),
    lat_min: typeof props.lat_min === 'number' ? props.lat_min : 0,
    lon_min: typeof props.lon_min === 'number' ? props.lon_min : 0,
    years: Array.isArray(props.years) ? props.years : [],
    feature_count: typeof props.feature_count === 'number' ? props.feature_count : undefined,
    size_bytes: typeof props.size_bytes === 'number' ? props.size_bytes : undefined,
  }
}

function closeDownloadModal() {
  showDownloadModal.value = false
  selectedGridCell.value = null
  selectedGridFeature.value = null
  downloadGridLayer.value?.changed()
}

// Toggle layer visibility and close the modal when the grid is turned off.
watch(
  () => settings.value.downloads,
  (visible) => {
    downloadGridLayer.value?.setVisible(visible)
    if (!visible) closeDownloadModal()
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

    const layer = createDownloadGridLayer(hoveredGridFeature, selectedGridFeature)
    downloadGridLayer.value = layer
    map.addLayer(layer)
    layer.setVisible(settings.value.downloads)

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

  /** Handle a map click; returns true if it hit a grid cell (and opened the modal). */
  const handleGridClick = (map: Map, pixel: number[]): boolean => {
    const layer = downloadGridLayer.value
    if (!settings.value.downloads || !layer) return false
    const feature =
      map.forEachFeatureAtPixel(pixel, (f) => f, {
        layerFilter: (l) => l === layer,
      }) ?? null
    if (!feature) return false
    selectedGridFeature.value = feature
    layer.changed()
    selectedGridCell.value = featureToGridCell(feature)
    showDownloadModal.value = true
    return true
  }

  return {
    showDownloadModal,
    selectedGridCell,
    downloadGridLayer,
    initDownloadGridLayer,
    handleGridClick,
    closeDownloadModal,
  }
}
