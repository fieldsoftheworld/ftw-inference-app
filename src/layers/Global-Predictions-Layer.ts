import VectorTileLayer from 'ol/layer/VectorTile'
import { PMTilesVectorSource } from 'ol-pmtiles'
import { Fill, Stroke, Style } from 'ol/style'

const PMTILES_URL =
  'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/ftw/global-data/predictions/vectors/alpha/global.pmtiles'

export function createGlobalPredictionsLayer(year: number) {
  const layer = new VectorTileLayer({
    source: new PMTilesVectorSource({
      url: PMTILES_URL,
    }),
    minZoom: 10,
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
          color: 'rgba(255, 100, 0, 0.8)',
          width: 1,
        }),
        fill: new Fill({
          color: 'rgba(255, 100, 0, 0.2)',
        }),
      })
    }
    return undefined
  })
}
