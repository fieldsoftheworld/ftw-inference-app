import VectorTileLayer from 'ol/layer/VectorTile'
import { PMTilesVectorSource } from 'ol-pmtiles'
import { Fill, Stroke, Style } from 'ol/style'

const PMTILES_URL =
  'https://geospatialvisualizer.z13.web.core.windows.net/ftw_visualizer/data/global_filtered.pmtiles'

export function createGlobalPredictionsLayerHighZoom() {
  const layer = new VectorTileLayer({
    source: new PMTilesVectorSource({
      url: PMTILES_URL,
    }),
    minZoom: 10,
    zIndex: 500,
    properties: {
      name: 'global-predictions',
    },
    style: new Style({
      stroke: new Stroke({
        color: 'rgba(255, 165, 0, 0.8)',
        width: 1,
      }),
      fill: new Fill({
        color: 'rgba(255, 165, 0, 0.2)',
      }),
    }),
  })

  return layer
}

// Convert resolution to approximate zoom level (Web Mercator)
function resolutionToZoom(resolution: number): number {
  return Math.log2(156543.03392 / resolution)
}

// Zoom breakpoints with corresponding maxCount values
// Add or adjust entries to fine-tune the color scale at each zoom level
const ZOOM_MAX_COUNT_BREAKPOINTS: [number, number][] = [
  [0, 100000000000],
  [2, 10000000000],
  [4, 1000000000],
  [6, 100000000],
  [8, 100000],
  [10, 5000],
]

// Calculate maxCount based on zoom level with linear interpolation between breakpoints
function getMaxCountForZoom(zoom: number): number {
  // Handle edge cases
  if (zoom <= ZOOM_MAX_COUNT_BREAKPOINTS[0][0]) {
    return ZOOM_MAX_COUNT_BREAKPOINTS[0][1]
  }
  if (zoom >= ZOOM_MAX_COUNT_BREAKPOINTS[ZOOM_MAX_COUNT_BREAKPOINTS.length - 1][0]) {
    return ZOOM_MAX_COUNT_BREAKPOINTS[ZOOM_MAX_COUNT_BREAKPOINTS.length - 1][1]
  }

  // Find the two breakpoints to interpolate between
  for (let i = 0; i < ZOOM_MAX_COUNT_BREAKPOINTS.length - 1; i++) {
    const [z1, max1] = ZOOM_MAX_COUNT_BREAKPOINTS[i]
    const [z2, max2] = ZOOM_MAX_COUNT_BREAKPOINTS[i + 1]

    if (zoom >= z1 && zoom < z2) {
      const t = (zoom - z1) / (z2 - z1)
      return Math.round(max1 + t * (max2 - max1))
    }
  }

  return ZOOM_MAX_COUNT_BREAKPOINTS[0][1]
}

// Color scale from light to dark (OrRd colorbrewer scale)
const COLOR_SCALE = [
  [255, 247, 236],
  [254, 232, 200],
  [253, 212, 158],
  [253, 187, 132],
  [252, 141, 89],
  [239, 101, 72],
  [215, 48, 31],
  [179, 0, 0],
  [127, 0, 0],
]

// Interpolate between two colors
function interpolateColor(color1: number[], color2: number[], t: number): [number, number, number] {
  return [
    Math.round(color1[0] + t * (color2[0] - color1[0])),
    Math.round(color1[1] + t * (color2[1] - color1[1])),
    Math.round(color1[2] + t * (color2[2] - color1[2])),
  ]
}

// Get color from scale based on normalized value (0-1)
function getColorFromScale(normalized: number): [number, number, number] {
  const n = COLOR_SCALE.length - 1
  const scaledIndex = normalized * n
  const lowerIndex = Math.floor(scaledIndex)
  const upperIndex = Math.min(lowerIndex + 1, n)
  const t = scaledIndex - lowerIndex

  return interpolateColor(COLOR_SCALE[lowerIndex], COLOR_SCALE[upperIndex], t)
}

function getCountStyle(count: number, maxCount: number): Style {
  // Use logarithmic scale for better distribution across varying magnitudes
  const logCount = Math.log10(count + 1)
  const logMax = Math.log10(maxCount + 1)
  const normalized = Math.min(logCount / logMax, 1)

  const [r, g, b] = getColorFromScale(normalized)

  return new Style({
    fill: new Fill({
      color: `rgba(${r}, ${g}, ${b}, 0.7)`,
    }),
    stroke: new Stroke({
      color: `rgba(${r}, ${g}, ${b}, 1)`,
      width: 1,
    }),
  })
}

export function createGlobalPredictionsLayerLowZoom() {
  const layer = new VectorTileLayer({
    source: new PMTilesVectorSource({
      url: 'https://geospatialvisualizer.z13.web.core.windows.net/ftw_visualizer/data/global_filtered_z12_counts_2024.pmtiles',
    }),
    minZoom: 0,
    maxZoom: 10,
    zIndex: 500,
    style: (feature, resolution) => {
      const zoom = resolutionToZoom(resolution)
      const maxCount = getMaxCountForZoom(zoom)
      const count = feature.get('polygon_count') || 0
      return getCountStyle(count, maxCount)
    },
  })

  return layer
}
