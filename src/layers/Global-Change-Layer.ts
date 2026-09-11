import type TileLayer from 'ol/layer/Tile'
import type ImageTileSource from 'ol/source/ImageTile'
import {
  GLOBAL_CHANGE_PMTILES_URL,
  GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
} from '../composables/useSettings'
import { createWorkerTileLayer } from './create-worker-tile-layer'

export interface GlobalChangeController {
  layer: TileLayer<ImageTileSource>
  dispose(): void
}

export function createGlobalChangeLayer(): GlobalChangeController {
  const base = createWorkerTileLayer(
    new URL('../workers/change-worker.ts', import.meta.url),
    { action: 'init', url: GLOBAL_CHANGE_PMTILES_URL },
    'global-changes',
    GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  )

  return {
    layer: base.layer,
    dispose: base.dispose,
  }
}
