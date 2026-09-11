import type TileLayer from 'ol/layer/Tile'
import type ImageTileSource from 'ol/source/ImageTile'
import {
  GLOBAL_DATA_PMTILES_THRESHOLD_METRIC,
  GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  get_global_pmtiles_url,
  type Settings,
} from '../composables/useSettings'
import { thresholdToRaw } from './color-scales'
import { createWorkerTileLayer } from './create-worker-tile-layer'

export interface GlobalPredictionsController {
  layer: TileLayer<ImageTileSource>
  update(settings: Settings): void
  dispose(): void
}

export function createGlobalPredictionsLayer(settings: Settings): GlobalPredictionsController {
  let revision = 0
  const base = createWorkerTileLayer(
    new URL('../workers/predictions-worker.ts', import.meta.url),
    {
      action: 'init',
      url: get_global_pmtiles_url(settings.year),
      threshold: thresholdToRaw(settings.threshold),
    },
    'global-predictions',
    GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  )

  return {
    layer: base.layer,
    update(newSettings: Settings) {
      base.postMessage({
        action: 'updateThreshold',
        threshold: thresholdToRaw(newSettings.threshold),
      })
      revision++
      base.refreshSource(`${GLOBAL_DATA_PMTILES_THRESHOLD_METRIC}-${revision}`)
    },
    dispose: base.dispose,
  }
}
