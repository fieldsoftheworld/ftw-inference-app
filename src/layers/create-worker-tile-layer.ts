import TileLayer from 'ol/layer/Tile'
import ImageTileSource from 'ol/source/ImageTile'

export interface WorkerTileLayerBase {
  layer: TileLayer<ImageTileSource>
  postMessage(msg: object): void
  refreshSource(key: string): void
  dispose(): void
}

export function createWorkerTileLayer(
  workerUrl: URL,
  initMessage: object,
  layerName: string,
  minZoom: number,
): WorkerTileLayerBase {
  const worker = new Worker(workerUrl, { type: 'module' })
  worker.postMessage(initMessage)

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
    minZoom,
    properties: { name: layerName },
  })

  return {
    layer,
    postMessage(msg: object) {
      worker.postMessage(msg)
    },
    refreshSource(key: string) {
      ;(source as any).setKey(key)
    },
    dispose() {
      disposeController.abort(new Error('Layer disposed'))
      worker.terminate()
    },
  }
}
