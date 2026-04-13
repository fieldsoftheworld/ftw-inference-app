import VectorTileLayer from 'ol/layer/VectorTile'
import { PMTilesVectorSource } from 'ol-pmtiles'
import { Fill, Stroke, Style } from 'ol/style'
import {
  GLOBAL_DATA_PMTILES_THRESHOLD_METRIC,
  GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  get_global_pmtiles_url,
  type Settings,
} from '../composables/useSettings'
import { globalPredictionsStyle } from './color-scales'

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

  const key = `confidence_${GLOBAL_DATA_PMTILES_THRESHOLD_METRIC}`
  const style = new Style({
    stroke: new Stroke({
      color: globalPredictionsStyle.stroke,
      width: 1,
    }),
    fill: new Fill({
      color: globalPredictionsStyle.fill,
    }),
  })
  layer.setStyle((feature) => (feature.get(key) <= settings.threshold ? undefined : style))

  return layer
}
