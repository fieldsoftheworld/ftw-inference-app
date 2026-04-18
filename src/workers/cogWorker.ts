import { fromUrl, Pool, type GeoTIFF } from 'geotiff'
import { areaColorScale } from '../layers/color-scales'

const WEB_MERCATOR_HALF = 20037508.342789244
const TILE_SIZE = 256
const TILE_PIXELS = TILE_SIZE * TILE_SIZE
const COG_VALUE_MAX = 200
const NODATA = 255
const OUT_ALPHA = 0xaa

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

const C0 = hexToRgb(areaColorScale[0].color)
const C1 = hexToRgb(areaColorScale[areaColorScale.length - 1].color)
const DR = C1[0] - C0[0]
const DG = C1[1] - C0[1]
const DB = C1[2] - C0[2]

function tileBbox3857(z: number, x: number, y: number): [number, number, number, number] {
  const size = (2 * WEB_MERCATOR_HALF) / Math.pow(2, z)
  const xmin = -WEB_MERCATOR_HALF + x * size
  const ymax = WEB_MERCATOR_HALF - y * size
  return [xmin, ymax - size, xmin + size, ymax]
}

let areaTiffPromise: Promise<GeoTIFF> | null = null
let confTiffPromise: Promise<GeoTIFF> | null = null
let sources: { areaUrl: string; confidenceUrl: string } | null = null
let pool: Pool | null = null

const MAX_ATTEMPTS = 3
const RETRY_BASE_MS = 150

// Large blocks so the initial IFD read + subsequent overview reads coalesce
// into a few range requests instead of hundreds. maxRanges enables
// multi-range HTTP requests where the server supports it (S3 does).
const SOURCE_OPTIONS = {
  blockSize: 512 * 1024,
  cacheSize: 256,
  maxRanges: 20,
}

async function openTiff(url: string): Promise<GeoTIFF> {
  const tiff = await fromUrl(url, SOURCE_OPTIONS as never)
  // Force IFD parse up front so tile requests skip the header round-trip.
  await tiff.getImage(0)
  return tiff
}

function getAreaTiff(): Promise<GeoTIFF> {
  if (!areaTiffPromise) {
    areaTiffPromise = openTiff(sources!.areaUrl).catch((err) => {
      areaTiffPromise = null
      throw err
    })
  }
  return areaTiffPromise
}

function getConfTiff(): Promise<GeoTIFF> {
  if (!confTiffPromise) {
    confTiffPromise = openTiff(sources!.confidenceUrl).catch((err) => {
      confTiffPromise = null
      throw err
    })
  }
  return confTiffPromise
}

async function renderTileOnce(
  z: number,
  x: number,
  y: number,
  threshold: number,
): Promise<ArrayBuffer> {
  const [areaTiff, confTiff] = await Promise.all([getAreaTiff(), getConfTiff()])
  const bbox = tileBbox3857(z, x, y)
  const [area, confidence] = await Promise.all([
    readBand(areaTiff, bbox),
    readBand(confTiff, bbox),
  ])
  const img = composite(area, confidence, threshold)
  return imageDataToPng(img)
}

async function renderTileWithRetry(
  z: number,
  x: number,
  y: number,
  threshold: number,
): Promise<ArrayBuffer> {
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await renderTileOnce(z, x, y, threshold)
    } catch (err) {
      lastErr = err
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
      }
    }
  }
  throw lastErr
}

async function readBand(
  tiff: GeoTIFF,
  bbox: [number, number, number, number],
): Promise<Uint8Array> {
  const rasters = await tiff.readRasters({
    bbox,
    width: TILE_SIZE,
    height: TILE_SIZE,
    samples: [0],
    interleave: false,
    fillValue: NODATA,
    pool: pool ?? undefined,
  })
  return (rasters as unknown as Uint8Array[])[0]
}

function composite(
  area: Uint8Array,
  confidence: Uint8Array,
  threshold: number,
): ImageData {
  const img = new ImageData(TILE_SIZE, TILE_SIZE)
  const data = img.data
  const tScaled = threshold * COG_VALUE_MAX
  const inv = 1 / COG_VALUE_MAX
  for (let i = 0, j = 0; i < TILE_PIXELS; i++, j += 4) {
    const a = area[i]
    if (a === NODATA || a <= 0) continue
    const c = confidence[i]
    if (c === NODATA || c <= tScaled) continue
    const k = a * inv
    data[j] = (C0[0] + DR * k) | 0
    data[j + 1] = (C0[1] + DG * k) | 0
    data[j + 2] = (C0[2] + DB * k) | 0
    data[j + 3] = OUT_ALPHA
  }
  return img
}

async function imageDataToPng(img: ImageData): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable')
  ctx.putImageData(img, 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return blob.arrayBuffer()
}

interface InitMsg {
  type: 'init'
  sources: { areaUrl: string; confidenceUrl: string }
}
interface TileMsg {
  type: 'tile'
  id: number
  z: number
  x: number
  y: number
  threshold: number
}
type IncomingMsg = InitMsg | TileMsg

self.onmessage = async (e: MessageEvent<IncomingMsg>) => {
  const msg = e.data
  if (msg.type === 'init') {
    sources = msg.sources
    areaTiffPromise = null
    confTiffPromise = null
    try {
      pool = new Pool()
    } catch {
      pool = null
    }
    // Kick off both COG opens immediately so tile requests don't wait on them
    void getAreaTiff().catch(() => {})
    void getConfTiff().catch(() => {})
    return
  }
  if (msg.type === 'tile') {
    const { id, z, x, y, threshold } = msg
    if (!sources) {
      ;(self as unknown as Worker).postMessage({ id, ok: false, error: 'not initialized' })
      return
    }
    try {
      const data = await renderTileWithRetry(z, x, y, threshold)
      ;(self as unknown as Worker).postMessage({ id, ok: true, data }, [data])
    } catch (err) {
      ;(self as unknown as Worker).postMessage({
        id,
        ok: false,
        error: (err as Error)?.message ?? 'cog tile failed',
      })
    }
  }
}
