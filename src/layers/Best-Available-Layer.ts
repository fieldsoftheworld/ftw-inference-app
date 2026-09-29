import VectorTileLayer from 'ol/layer/VectorTile'
import { PMTilesVectorSource } from 'ol-pmtiles'
import { Fill, Stroke, Style } from 'ol/style'
import { GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL } from '../composables/useSettings'
import type { BestAvailableCollection } from '../composables/useBestAvailable'

// Readable at 20% fill over satellite imagery and the FTW layer.
export const PALETTE = [
  '#3fd17a',
  '#c07cf0',
  '#f0883e',
  '#4aa3f0',
  '#f05fa8',
  '#2fbfb0',
  '#d9b310',
  '#e05c4a',
]

export function colorFor(position: number): string {
  return PALETTE[position % PALETTE.length]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function styleFor(color: string): Style {
  return new Style({
    fill: new Fill({ color: color + '33' }),
    stroke: new Stroke({ color, width: 1 }),
  })
}

export function applyColor(layer: VectorTileLayer, color: string) {
  layer.setStyle(styleFor(color))
}

export function createBestAvailableLayer(
  collection: BestAvailableCollection,
  color: string,
): VectorTileLayer {
  return new VectorTileLayer({
    source: new PMTilesVectorSource({
      url: collection.pmtiles,
      attributions: attributionFor(collection),
    }),
    style: styleFor(color),
    minZoom: GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
    zIndex: 60,
    properties: { name: `best-available-${collection.id}` },
  })
}

export function attributionFor(collection: BestAvailableCollection): string {
  const name = escapeHtml(collection.provider)
  const link = collection.providerUrl
    ? `<a href="${escapeHtml(collection.providerUrl)}" target="_blank" rel="noopener">${name}</a>`
    : name
  return `${link} (${escapeHtml(collection.license)})`
}
