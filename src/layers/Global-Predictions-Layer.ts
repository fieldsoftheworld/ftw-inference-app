import VectorTileLayer from 'ol/layer/VectorTile'
import { PMTilesVectorSource } from 'ol-pmtiles'
import { Fill, Stroke, Style } from 'ol/style'
import {
  GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  GLOBAL_DATA_PMTILES,
} from '../composables/useSettings'
import { globalPredictionsStyle } from './color-scales'

export function createGlobalPredictionsLayer(year: number) {
  const layer = new VectorTileLayer({
    source: new PMTilesVectorSource({
      url: GLOBAL_DATA_PMTILES,
    }),
    minZoom: GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
    properties: {
      name: 'global-predictions',
    },
  })
  updateGlobalPredictionsLayer(layer, year)
  return layer
}

export function updateGlobalPredictionsLayer(layer: VectorTileLayer, year: number) {
  layer.setStyle((feature) => {
    const layer = feature.get('layer')
    if (layer === `field-${year}-01-01 00:00:00`) {
      return new Style({
        stroke: new Stroke({
          color: globalPredictionsStyle.stroke,
          width: 1,
        }),
        fill: new Fill({
          color: globalPredictionsStyle.fill,
        }),
      })
    }
    return undefined
  })
}
