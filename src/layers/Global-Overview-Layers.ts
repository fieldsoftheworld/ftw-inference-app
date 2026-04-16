import GeoTIFF from 'ol/source/GeoTIFF'
import GlTileLayer from 'ol/layer/WebGLTile.js'
import {
  AREA_OVERVIEW_COG,
  CONFIDENCE_OVERVIEW_COG,
  GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  type Settings,
} from '../composables/useSettings'
import { areaColorScale, type ColorStop } from './color-scales'

const ALPHA = 'aa'

function buildAreaInterpolation(stops: ColorStop[]): unknown[] {
  const entries: unknown[] = []
  for (const stop of stops) {
    entries.push(stop.value, stop.color + ALPHA)
  }
  return ['interpolate', ['linear'], ['band', 1], ...entries]
}

const overviewStyle = (settings: Settings) => {
  return {
    color: [
      'case',
      ['<=', ['band', 1], 0],
      '#00000000', // no area data
      ['<=', ['band', 2], settings.threshold],
      '#00000000', // confidence below threshold
      buildAreaInterpolation(areaColorScale), // show area colors
    ],
  }
}

export const createGlobalOverviewLayer = (settings: Settings) => {
  const layer = new GlTileLayer({
    source: new GeoTIFF({
      sources: [
        {
          url: AREA_OVERVIEW_COG,
          nodata: 255,
          min: 0,
          max: 200,
        },
        {
          url: CONFIDENCE_OVERVIEW_COG,
          nodata: 255,
          min: 0,
          max: 200,
        },
      ],
      interpolate: false,
      sourceOptions: {
        blockSize: 512 * 1024, // 512KB: capture all IFDs in 1-2 requests instead of 100+
      },
    }),
    minZoom: 0,
    maxZoom: GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  })
  updateGlobalOverviewLayer(layer, settings)
  return layer
}

export const updateGlobalOverviewLayer = (layer: GlTileLayer, settings: Settings) => {
  layer.setStyle(overviewStyle(settings))
}
