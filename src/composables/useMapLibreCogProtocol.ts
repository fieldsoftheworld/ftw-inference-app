import maplibregl from 'maplibre-gl'
import CogWorker from '../workers/cogWorker.ts?worker'

type CogState = {
  threshold: number
}

type CogSources = {
  areaUrl: string
  confidenceUrl: string
}

type PendingTile = {
  resolve: (resp: { data: ArrayBuffer }) => void
  reject: (err: Error) => void
}

const POOL_SIZE = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 1))

let workers: Worker[] = []
let rrIndex = 0
let nextId = 0
const pending = new Map<number, PendingTile>()

function parseTileUrl(url: string): { z: number; x: number; y: number } | null {
  const m = url.match(/cog:\/\/[^/]+\/(\d+)\/(\d+)\/(\d+)/)
  if (!m) return null
  return { z: Number(m[1]), x: Number(m[2]), y: Number(m[3]) }
}

function pickWorker(): Worker {
  const w = workers[rrIndex]
  rrIndex = (rrIndex + 1) % workers.length
  return w
}

export function registerCogProtocol(sources: CogSources, state: CogState) {
  for (const w of workers) w.terminate()
  workers = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const w = new CogWorker()
    w.onmessage = (e: MessageEvent) => {
      const { id, ok, data, error } = e.data as {
        id: number
        ok: boolean
        data?: ArrayBuffer
        error?: string
      }
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      if (ok && data) p.resolve({ data })
      else p.reject(new Error(error ?? 'cog worker failed'))
    }
    w.postMessage({ type: 'init', sources })
    workers.push(w)
  }

  maplibregl.addProtocol('cog', (params: { url: string }) => {
    return new Promise<{ data: ArrayBuffer }>((resolve, reject) => {
      const parsed = parseTileUrl(params.url)
      if (!parsed || workers.length === 0) {
        reject(new Error(`bad cog url or worker pool empty: ${params.url}`))
        return
      }
      const id = nextId++
      pending.set(id, { resolve, reject })
      pickWorker().postMessage({
        type: 'tile',
        id,
        z: parsed.z,
        x: parsed.x,
        y: parsed.y,
        threshold: state.threshold,
      })
    })
  })
}

export function unregisterCogProtocol() {
  maplibregl.removeProtocol('cog')
  for (const w of workers) w.terminate()
  workers = []
  for (const [, p] of pending) p.reject(new Error('cog protocol unregistered'))
  pending.clear()
}
