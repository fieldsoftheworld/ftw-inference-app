import TileLayer from 'ol/layer/Tile'
import ImageTileSource from 'ol/source/ImageTile'
import {
  GLOBAL_DATA_PMTILES_THRESHOLD_METRIC,
  GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  get_global_pmtiles_url,
  type Settings,
} from '../composables/useSettings'
import { thresholdToRaw } from './color-scales'

export interface GlobalPredictionsController {
  layer: TileLayer<ImageTileSource>
  update(settings: Settings): void
  dispose(): void
}

export function createGlobalPredictionsLayer(settings: Settings): GlobalPredictionsController {
  const worker = new Worker(new URL('../workers/predictions-worker.ts', import.meta.url), {
    type: 'module',
  })

  worker.postMessage({
    action: 'init',
    url: get_global_pmtiles_url(settings.year),
    threshold: thresholdToRaw(settings.threshold),
  })

  let revision = 0
  const tileQueue: Array<() => void> = []
  const disposeController = new AbortController()
  const disposeSignal = disposeController.signal

  const source = new ImageTileSource({
    tileSize: 512,
    loader: (z, x, y, { signal }) => {
      return new Promise<ImageBitmap>((resolve, reject) => {
        if (signal.aborted) {
          reject(signal.reason)
          return
        }
        if (disposeSignal.aborted) {
          reject(disposeSignal.reason)
          return
        }
        const abandon = (reason: unknown) => {
          reject(reason)
          tileQueue.shift()
          tileQueue[0]?.()
        }
        const loadTile = () => {
          if (signal.aborted) {
            abandon(signal.reason)
            return
          }
          if (disposeSignal.aborted) {
            abandon(disposeSignal.reason)
            return
          }
          let settled = false
          const handleMessage = ({ data: { action, imageData } }: MessageEvent) => {
            if (action !== 'rendered' && action !== 'error') return
            if (settled) return
            settled = true
            worker.removeEventListener('message', handleMessage)
            if (action === 'error') {
              reject(new Error('Worker failed to render tile'))
            } else {
              resolve(imageData)
            }
            tileQueue.shift()
            tileQueue[0]?.()
          }
          const onAbort = (reason: unknown) => {
            if (settled) return
            settled = true
            worker.removeEventListener('message', handleMessage)
            abandon(reason)
          }
          signal.addEventListener('abort', () => onAbort(signal.reason), { once: true })
          disposeSignal.addEventListener('abort', () => onAbort(disposeSignal.reason), {
            once: true,
          })
          worker.addEventListener('message', handleMessage)
          worker.postMessage({ action: 'render', tile: [z, x, y] })
        }
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        disposeSignal.addEventListener('abort', () => reject(disposeSignal.reason), { once: true })
        if (tileQueue.length === 0) {
          loadTile()
        }
        tileQueue.push(loadTile)
      })
    },
  })

  const layer = new TileLayer({
    source,
    minZoom: GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
    properties: { name: 'global-predictions' },
  })

  return {
    layer,
    update(newSettings: Settings) {
      worker.postMessage({
        action: 'updateThreshold',
        threshold: thresholdToRaw(newSettings.threshold),
      })
      revision++
      ;(source as any).setKey(`${GLOBAL_DATA_PMTILES_THRESHOLD_METRIC}-${revision}`)
    },
    dispose() {
      disposeController.abort(new Error('Layer disposed'))
      worker.terminate()
    },
  }
}
