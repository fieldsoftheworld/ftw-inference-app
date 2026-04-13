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
    source: new PMTilesVectorSource({
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
  layer.setStyle((feature) => {
    const confidence = feature.get(key)
    if (confidence <= settings.threshold) return undefined
    return new Style({
      stroke: new Stroke({
        color: getColorForValue(confidenceColorScale, confidence, 1),
        width: 1,
      }),
      fill: new Fill({
        color: getColorForValue(confidenceColorScale, confidence, 0.3),
      }),
    })
  })
}
