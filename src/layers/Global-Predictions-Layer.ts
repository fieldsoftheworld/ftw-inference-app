import VectorTileLayer from 'ol/layer/VectorTile'
import { PMTilesVectorSource } from 'ol-pmtiles'
import { Fill, Stroke, Style } from 'ol/style'
import {
  GLOBAL_DATA_PMTILES_THRESHOLD_METRIC,
  GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  get_global_pmtiles_url,
  type Settings,
} from '../composables/useSettings'
import { confidenceColorScale, getColorForValue } from './color-scales'

export function createGlobalPredictionsLayer(settings: Settings) {
  const layer = new VectorTileLayer({
    declutter: false,
    source: new PMTilesVectorSource({
      overlaps: false,
      url: get_global_pmtiles_url(settings.year),
    }),
    minZoom: GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
    properties: {
      name: `global-predictions`,
    },
  })
  updateGlobalPredictionsLayer(layer, settings)
  return layer
}

export function updateGlobalPredictionsLayer(layer: VectorTileLayer, settings: Settings) {
  const key = `confidence_${GLOBAL_DATA_PMTILES_THRESHOLD_METRIC}`
  const stroke = new Stroke({
    color: '',
    width: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 1,
  })
  const fill = new Fill({ color: '' })
  const polyStyle = new Style({ stroke, fill })
  const smallStyle = new Style({ stroke })
  layer.setStyle((feature, resolution) => {
    const confidence = feature.get(key)
    if (confidence <= settings.threshold) return undefined
    const strokeColor = getColorForValue(confidenceColorScale, confidence, 1)
    stroke.setColor(strokeColor)
    const extent = feature.getGeometry()!.getExtent()
    const widthPx = (extent[2] - extent[0]) / resolution
    const heightPx = (extent[3] - extent[1]) / resolution
    if (widthPx < 3 && heightPx < 3) {
      return smallStyle
    }
    fill.setColor(getColorForValue(confidenceColorScale, confidence, 0.3))
    return polyStyle
  })
}
