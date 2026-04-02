import GeoTIFF from 'ol/source/GeoTIFF'
import GlTileLayer from 'ol/layer/WebGLTile.js'
import type { Settings } from '../composables/useSettings'

export const areaStyle = (settings: Settings) => {
  return {
    color: [
      'case',
      ['<=', ['band', 1], settings.threshold],
      '#00000000',
      [
        'interpolate',
        ['linear'],
        ['band', 1],
        0,
        '#d7191caa',
        0.25,
        '#fec379aa',
        0.5,
        '#f3fabbaa',
        0.75,
        '#cfecb0aa',
        1,
        '#33a02caa',
      ],
    ],
  }
}

export const confidenceStyle = (settings: Settings) => {
  // todo: Use threshold
  return {
    color: [
      'case',
      ['<=', ['band', 1], settings.threshold],
      '#00000000',
      [
        'interpolate',
        ['linear'],
        ['band', 1],
        0,
        '#d7191caa',
        0.25,
        '#fec379aa',
        0.5,
        '#f3fabbaa',
        0.75,
        '#cfecb0aa',
        1,
        '#33a02caa',
      ],
    ],
  }
}

const areaCogUrl =
  'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/m-mohr/ftw-confidence-layers/prue_v1_field_area_500m_fieldsonly.tif'
const confidenceCogUrl =
  'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/m-mohr/ftw-confidence-layers/prue_v1_confidence_global.tif'

export const createGlobalOverviewLayer = (settings: Settings) => {
  const layer = new GlTileLayer({
    source: new GeoTIFF({
      sources: [
        {
          // todo: try https://tiles.rdnt.io/tiles/{z}/{x}/{y}@2x?url=
          url: settings.aggregate === 'confidence' ? confidenceCogUrl : areaCogUrl,
          min: settings.aggregate === 'confidence' ? 0 : 0,
          max: settings.aggregate === 'confidence' ? 1 : 2500,
        },
      ],
    }),
    minZoom: 0,
    maxZoom: 10,
  })
  updateGlobalOverviewLayer(layer, settings)
  return layer
}

export const updateGlobalOverviewLayer = (layer: GlTileLayer, settings: Settings) => {
  layer.setStyle(
    settings.aggregate === 'confidence' ? confidenceStyle(settings) : areaStyle(settings),
  )
}
