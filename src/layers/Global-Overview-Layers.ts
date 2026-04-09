import GeoTIFF from 'ol/source/GeoTIFF'
import GlTileLayer from 'ol/layer/WebGLTile.js'
import {
  AREA_OVERVIEW_COG,
  CONFIDENCE_OVERVIEW_COG,
  GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  type Settings,
} from '../composables/useSettings'
import { areaColorScale, confidenceColorScale, type ColorStop } from './color-scales'

const ALPHA = 'aa'

function buildInterpolation(stops: ColorStop[]): unknown[] {
  const entries: unknown[] = []
  for (const stop of stops) {
    entries.push(stop.value, stop.color + ALPHA)
  }
  return ['interpolate', ['linear'], ['band', 1], ...entries]
}

export const areaStyle = {
  color: ['case', ['<=', ['band', 1], 0], '#00000000', buildInterpolation(areaColorScale)],
}

export const confidenceStyle = (settings: Settings) => {
  return {
    color: [
      'case',
      ['<=', ['band', 1], settings.threshold],
      '#00000000',
      buildInterpolation(confidenceColorScale),
    ],
  }
}

export const createGlobalOverviewLayer = (settings: Settings) => {
  const layer = new GlTileLayer({
    source: new GeoTIFF({
      sources: [
        {
          // todo: try https://tiles.rdnt.io/tiles/{z}/{x}/{y}@2x?url=
          url: settings.aggregate === 'confidence' ? CONFIDENCE_OVERVIEW_COG : AREA_OVERVIEW_COG,
          min: 0,
          max: settings.aggregate === 'confidence' ? 1 : 2500,
        },
      ],
    }),
    minZoom: 0,
    maxZoom: GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  })
  updateGlobalOverviewLayer(layer, settings)
  return layer
}

export const updateGlobalOverviewLayer = (layer: GlTileLayer, settings: Settings) => {
  layer.setStyle(settings.aggregate === 'confidence' ? confidenceStyle(settings) : areaStyle)
}
