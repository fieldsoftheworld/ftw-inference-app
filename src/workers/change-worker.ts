import Map from 'ol/Map'
import View from 'ol/View'
import VectorTileLayer from 'ol/layer/VectorTile'
import { PMTilesVectorSource } from 'ol-pmtiles'
import { Fill, Stroke, Style } from 'ol/style'
import { createXYZ } from 'ol/tilegrid'
import { changeStyleGain, changeStyleLoss } from '../layers/color-scales'

const TILE_SIZE = 512
const tileGrid = createXYZ({ tileSize: [TILE_SIZE, TILE_SIZE] })
const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE)

const classMap: Record<number, { stroke: string; fill: string }> = {
  1: changeStyleGain,
  2: changeStyleLoss,
}

const getStroke = (classNum: number): Stroke => {
  return new Stroke({
    color: classMap[classNum].stroke,
    width: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 1,
  })
}
const getFill = (classNum: number): Fill => {
  return new Fill({
    color: classMap[classNum].fill,
  })
}

const polyStyleGain = new Style({ stroke: getStroke(1), fill: getFill(1) })
const polyStyleLoss = new Style({ stroke: getStroke(2), fill: getFill(2) })

const layer = new VectorTileLayer({
  renderMode: 'vector',
  declutter: false,
})

layer.setStyle((feature) => {
  const cls = feature.get('class') as string
  if (cls === '1') {
    return polyStyleGain
  } else if (cls === '2') {
    return polyStyleLoss
  }
})

const map = new Map({
  target: canvas,
  layers: [layer],
  pixelRatio: 1,
  controls: [],
  interactions: [],
})
map.setSize([TILE_SIZE, TILE_SIZE])

// Workaround for OpenLayers not clearing the canvas between renders
//FIXME: Remove when https://github.com/openlayers/openlayers/pull/17453 is released
layer.on('prerender', () => {
  canvas.width = TILE_SIZE
})

let sourceReady: Promise<void> | null = null
let isRendering = false
let pendingRender: { tile: number[] } | null = null

function startRender(tile: number[]) {
  isRendering = true
  const view = new View({
    center: tileGrid.getTileCoordCenter(tile),
    resolution: tileGrid.getResolution(tile[0]),
  })
  map.setView(view)
  map.once('rendercomplete', () => {
    if (pendingRender) {
      const { tile: nextTile } = pendingRender
      pendingRender = null
      startRender(nextTile)
      return
    }
    isRendering = false
    const imageData = canvas.transferToImageBitmap()
    self.postMessage({ action: 'rendered', imageData }, [imageData] as any)
  })
}

self.addEventListener('message', async ({ data: { action, tile, url } }) => {
  if (action === 'init') {
    const source = new PMTilesVectorSource({ overlaps: false, url })
    layer.setSource(source)
    sourceReady = new Promise<void>((resolve, reject) => {
      if (source.getState() === 'ready') {
        resolve()
        return
      }
      if (source.getState() === 'error') {
        reject(new Error('Source failed to load'))
        return
      }
      const timeout = setTimeout(() => reject(new Error('Source timed out')), 10000)
      const check = () => {
        if (source.getState() === 'ready') {
          clearTimeout(timeout)
          resolve()
        } else if (source.getState() === 'error') {
          clearTimeout(timeout)
          reject(new Error('Source failed to load'))
        } else source.once('change', check)
      }
      source.once('change', check)
    })
    return
  }
  if (action !== 'render') return
  try {
    await sourceReady
  } catch {
    self.postMessage({ action: 'error' })
    return
  }
  if (isRendering) {
    pendingRender = { tile }
  } else {
    startRender(tile)
  }
})
