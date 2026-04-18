<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import maplibregl from 'maplibre-gl'
import { PMTiles, Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import { confidenceColorScale } from '../layers/color-scales'
import useSettings, {
  AREA_OVERVIEW_COG,
  CONFIDENCE_OVERVIEW_COG,
  GLOBAL_DATA_PMTILES_THRESHOLD_METRIC,
  GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
  get_global_pmtiles_url,
} from '../composables/useSettings'
import {
  registerCogProtocol,
  unregisterCogProtocol,
} from '../composables/useMapLibreCogProtocol'

const { settings } = useSettings()
const mapContainer = ref<HTMLDivElement | null>(null)
const status = ref<string>('initializing…')
const sliderDisplay = ref<number>(settings.value.threshold)
const updating = ref<boolean>(false)
const viewLat = ref<number>(42.0)
const viewLon = ref<number>(-93.5)
const viewZoom = ref<number>(10)
const cogState = { threshold: settings.value.threshold }
let cogVersion = 0
let overviewDebounce: ReturnType<typeof setTimeout> | null = null
let map: maplibregl.Map | null = null

function cogTileUrl(): string {
  return `cog://overview/{z}/{x}/{y}?v=${cogVersion}`
}

function reloadOverviewTiles() {
  if (!map) return
  cogVersion++
  const overviewSource = map.getSource('overview') as maplibregl.RasterTileSource | undefined
  overviewSource?.setTiles([cogTileUrl()])
}

const CONFIDENCE_KEY = `confidence_${GLOBAL_DATA_PMTILES_THRESHOLD_METRIC}`

function clampS2Year(year: number): number {
  if (year < 2016) return 2016
  if (year > 2024) return 2024
  return year
}

function s2CloudlessUrl(year: number): string {
  const y = clampS2Year(year)
  const suffix = y === 2016 ? '' : `-${y}`
  return `https://tiles.maps.eox.at/wmts?layer=s2cloudless${suffix}_3857&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fjpeg&TileMatrix={z}&TileCol={x}&TileRow={y}`
}

function fillColorExpression(): unknown[] {
  const expr: unknown[] = ['interpolate', ['linear'], ['to-number', ['get', CONFIDENCE_KEY], 0]]
  for (const stop of confidenceColorScale) {
    expr.push(stop.value, stop.color)
  }
  return expr
}

function fillOpacityExpression(): unknown[] {
  return [
    'case',
    ['>', ['to-number', ['get', CONFIDENCE_KEY], 0], ['global-state', 'threshold']],
    0.3,
    0,
  ]
}

function lineOpacityExpression(): unknown[] {
  return [
    'case',
    ['>', ['to-number', ['get', CONFIDENCE_KEY], 0], ['global-state', 'threshold']],
    1,
    0,
  ]
}

async function resolveSourceLayer(pmtilesUrl: string): Promise<string> {
  const pmt = new PMTiles(pmtilesUrl)
  const metadata = (await pmt.getMetadata()) as { vector_layers?: Array<{ id: string }> }
  const id = metadata?.vector_layers?.[0]?.id
  if (!id) throw new Error('PMTiles metadata missing vector_layers')
  return id
}

onMounted(async () => {
  if (!mapContainer.value) return

  const pmtProtocol = new Protocol()
  maplibregl.addProtocol('pmtiles', pmtProtocol.tile)

  registerCogProtocol(
    { areaUrl: AREA_OVERVIEW_COG, confidenceUrl: CONFIDENCE_OVERVIEW_COG },
    cogState,
  )

  const pmtilesUrl = get_global_pmtiles_url(settings.value.year)

  let sourceLayer: string
  try {
    sourceLayer = await resolveSourceLayer(pmtilesUrl)
  } catch (err) {
    status.value = `failed to read PMTiles: ${(err as Error).message}`
    return
  }

  maplibregl.setMaxParallelImageRequests(32)

  map = new maplibregl.Map({
    container: mapContainer.value,
    center: [-93.5, 42.0],
    zoom: 10,
    minZoom: 2,
    maxZoom: 16,
    hash: false,
    style: {
      version: 8,
      state: {
        threshold: { default: settings.value.threshold },
      },
      sources: {
        basemap: {
          type: 'raster',
          tiles: [s2CloudlessUrl(settings.value.year)],
          tileSize: 256,
          maxzoom: 16,
          attribution:
            '<a href="https://s2maps.eu" target="_blank">Sentinel-2 cloudless</a> by <a href="https://eox.at" target="_blank">EOX IT Services GmbH</a>',
        },
        overview: {
          type: 'raster',
          tiles: [cogTileUrl()],
          tileSize: 256,
          minzoom: 0,
          maxzoom: GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
          attribution: 'Field boundary overview · FTW',
        },
        predictions: {
          type: 'vector',
          url: `pmtiles://${pmtilesUrl}`,
        },
      },
      layers: [
        { id: 'basemap', type: 'raster', source: 'basemap' },
        {
          id: 'overview-raster',
          type: 'raster',
          source: 'overview',
          maxzoom: GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
          paint: { 'raster-resampling': 'nearest' },
        },
        {
          id: 'predictions-fill',
          type: 'fill',
          source: 'predictions',
          'source-layer': sourceLayer,
          minzoom: GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
          paint: {
            'fill-color': fillColorExpression() as never,
            'fill-opacity': fillOpacityExpression() as never,
          },
        },
        {
          id: 'predictions-line',
          type: 'line',
          source: 'predictions',
          'source-layer': sourceLayer,
          minzoom: GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
          paint: {
            'line-color': fillColorExpression() as never,
            'line-width': 1,
            'line-opacity': lineOpacityExpression() as never,
          },
        },
      ],
    },
  })

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left')

  map.on('load', () => {
    status.value = `ready · source-layer: ${sourceLayer}`
  })
  map.on('error', (e) => {
    status.value = `error: ${e.error?.message ?? 'unknown'}`
  })

  const updateView = () => {
    if (!map) return
    const c = map.getCenter()
    viewLat.value = c.lat
    viewLon.value = c.lng
    viewZoom.value = map.getZoom()
  }
  map.on('move', updateView)
  map.on('zoom', updateView)
  updateView()
})

function onThresholdInput(raw: string) {
  const t = Number(raw)
  if (!Number.isFinite(t)) return
  sliderDisplay.value = t
  cogState.threshold = t
  // Live-update the COG overview as the user drags. Debounce so we don't
  // re-request tiles on every pixel of movement.
  if (overviewDebounce) clearTimeout(overviewDebounce)
  overviewDebounce = setTimeout(reloadOverviewTiles, 80)
}

function commitThreshold(raw: string) {
  const t = Number(raw)
  if (!Number.isFinite(t)) return
  settings.value.threshold = t
  cogState.threshold = t
  if (!map) return
  updating.value = true
  map.setGlobalStateProperty('threshold', t)
  reloadOverviewTiles()
  map.once('idle', () => {
    updating.value = false
  })
}

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
  maplibregl.removeProtocol('pmtiles')
  unregisterCogProtocol()
})
</script>

<template>
  <div class="ml-wrap">
    <div ref="mapContainer" class="ml-map" />
    <div class="ml-controls">
      <div class="ml-header">
        <router-link to="/">← main app</router-link>
        <span class="ml-status">{{ status }}</span>
      </div>
      <div class="ml-slider">
        <label>
          Confidence threshold:
          <strong>{{ sliderDisplay.toFixed(2) }}</strong>
          <span v-if="updating" class="ml-spinner">· updating…</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="sliderDisplay"
          @input="(e) => onThresholdInput((e.target as HTMLInputElement).value)"
          @change="(e) => commitThreshold((e.target as HTMLInputElement).value)"
        />
        <div class="ml-note">Overview updates live · fields update on release.</div>
      </div>
      <div class="ml-hint">Year: {{ settings.year }} · pan at z ≥ 10</div>
    </div>
    <div class="ml-readout">
      <div>lat <span>{{ viewLat.toFixed(5) }}</span></div>
      <div>lon <span>{{ viewLon.toFixed(5) }}</span></div>
      <div>zoom <span>{{ viewZoom.toFixed(2) }}</span></div>
    </div>
  </div>
</template>

<style scoped>
.ml-wrap {
  position: fixed;
  inset: 0;
}
.ml-map {
  width: 100%;
  height: 100%;
}
.ml-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.96);
  color: #1e1e1e;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 240px;
  font-size: 13px;
  z-index: 10;
}
.ml-controls label {
  color: #1e1e1e;
}
.ml-controls strong {
  color: #000;
}
.ml-header a {
  color: #1062c2;
  text-decoration: none;
  font-weight: 500;
}
.ml-header a:hover {
  text-decoration: underline;
}
.ml-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.ml-status {
  font-size: 11px;
  color: #555;
  font-family: monospace;
  text-align: right;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ml-slider {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ml-slider input {
  width: 100%;
}
.ml-hint {
  font-size: 11px;
  color: #555;
}
.ml-note {
  font-size: 11px;
  color: #555;
  margin-top: 2px;
}
.ml-spinner {
  font-size: 11px;
  color: #b26a00;
  margin-left: 4px;
}
.ml-readout {
  position: absolute;
  bottom: 36px;
  right: 16px;
  background: rgba(0, 0, 0, 0.72);
  color: #e8e8e8;
  padding: 8px 12px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  z-index: 10;
  min-width: 150px;
}
.ml-readout span {
  float: right;
  margin-left: 8px;
}
</style>
