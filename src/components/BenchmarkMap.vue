<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, shallowRef, nextTick } from 'vue'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import GeoJSON from 'ol/format/GeoJSON'
import Feature from 'ol/Feature'
import { Fill, Stroke, Style } from 'ol/style'
import { createEmpty, extend as extendExtent, isEmpty } from 'ol/extent'
import type { Extent } from 'ol/extent'
import type { Feature as GeoJSONFeature, FeatureCollection } from 'geojson'

export type BenchmarkMapChip = {
  chip_id: string
  footprint: GeoJSONFeature
  predictions: FeatureCollection
  ground_truth: FeatureCollection
}

const props = defineProps<{
  mapData: { chips: BenchmarkMapChip[] } | null
}>()

const mapRoot = ref<HTMLElement | null>(null)
const mapInstance = shallowRef<Map | null>(null)

const fmt = new GeoJSON({ dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' })

const footprintStyle = new Style({
  stroke: new Stroke({ color: '#fbbf24', width: 2, lineDash: [8, 4] }),
  fill: new Fill({ color: 'rgba(251, 191, 36, 0.06)' }),
})
const gtStyle = new Style({
  fill: new Fill({ color: 'rgba(34, 197, 94, 0.4)' }),
  stroke: new Stroke({ color: '#16a34a', width: 2 }),
})
const predStyle = new Style({
  fill: new Fill({ color: 'rgba(59, 130, 246, 0.4)' }),
  stroke: new Stroke({ color: '#2563eb', width: 2 }),
})

function buildSourcesFromPayload(data: { chips: BenchmarkMapChip[] }) {
  const footSource = new VectorSource()
  const gtSource = new VectorSource()
  const predSource = new VectorSource()
  for (const c of data.chips) {
    if (c.footprint) {
      const parsed = fmt.readFeature(c.footprint)
      const f = (Array.isArray(parsed) ? parsed[0] : parsed) as Feature
      f.setStyle(footprintStyle)
      footSource.addFeature(f)
    }
    if (c.ground_truth?.features?.length) {
      const feats = fmt.readFeatures(c.ground_truth)
      feats.forEach((f) => f.setStyle(gtStyle))
      gtSource.addFeatures(feats)
    }
    if (c.predictions?.features?.length) {
      const feats = fmt.readFeatures(c.predictions)
      feats.forEach((f) => f.setStyle(predStyle))
      predSource.addFeatures(feats)
    }
  }
  return { footSource, gtSource, predSource }
}

function fitToSources(map: Map, sources: VectorSource[]) {
  let ext: Extent = createEmpty()
  for (const s of sources) {
    const le = s.getExtent()
    if (!isEmpty(le)) extendExtent(ext, le)
  }
  if (!isEmpty(ext)) {
    map.getView().fit(ext, { padding: [48, 48, 48, 48], maxZoom: 17, duration: 200 })
  }
}

function ensureMap(): Map | null {
  if (mapInstance.value) return mapInstance.value
  const el = mapRoot.value
  if (!el) return null
  const base = new TileLayer({
    source: new XYZ({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attributions: '© OpenStreetMap contributors',
    }),
  })
  const m = new Map({
    target: el,
    layers: [base],
    view: new View({ center: [0, 0], zoom: 2 }),
  })
  mapInstance.value = m
  return m
}

function applyPayload() {
  const map = mapInstance.value
  if (!map) return
  const layers = map.getLayers()
  while (layers.getLength() > 1) {
    layers.pop()
  }
  const data = props.mapData
  if (!data?.chips?.length) return
  const { footSource, gtSource, predSource } = buildSourcesFromPayload(data)
  map.addLayer(
    new VectorLayer({
      source: footSource,
      zIndex: 1,
    }),
  )
  map.addLayer(
    new VectorLayer({
      source: gtSource,
      zIndex: 2,
    }),
  )
  map.addLayer(
    new VectorLayer({
      source: predSource,
      zIndex: 3,
    }),
  )
  fitToSources(map, [footSource, gtSource, predSource])
  map.updateSize()
  requestAnimationFrame(() => map.updateSize())
}

async function syncMapToData() {
  await nextTick()
  if (!props.mapData?.chips?.length) {
    return
  }
  if (!mapRoot.value) {
    await nextTick()
  }
  const map = ensureMap()
  if (!map) return
  applyPayload()
}

watch(
  () => props.mapData,
  () => {
    void syncMapToData()
  },
  { deep: true, immediate: true, flush: 'post' },
)

onMounted(() => {
  void syncMapToData()
})

onUnmounted(() => {
  mapInstance.value?.setTarget(undefined)
  mapInstance.value = null
})
</script>

<template>
  <div class="benchmark-map-wrap">
    <div
      v-if="!mapData?.chips?.length"
      class="benchmark-map-empty text-caption text-medium-emphasis"
    >
      No map geometry for this selection.
    </div>
    <!-- Keep host in DOM whenever parent may pass data on next tick; OL needs a real size. -->
    <div v-show="mapData?.chips?.length" ref="mapRoot" class="benchmark-map" />
    <div v-if="mapData?.chips?.length" class="legend text-caption">
      <span><span class="swatch gt" /> Ground truth</span>
      <span><span class="swatch pred" /> Model predictions</span>
      <span><span class="swatch foot" /> Chip footprint</span>
    </div>
  </div>
</template>

<style scoped>
.benchmark-map-wrap {
  position: relative;
}
.benchmark-map {
  width: 100%;
  height: 420px;
  border-radius: 8px;
  overflow: hidden;
  background: #1a1a1a;
}
.benchmark-map-empty {
  padding: 2rem;
  text-align: center;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.5rem;
  color: #aaa;
}
.legend .swatch {
  display: inline-block;
  width: 14px;
  height: 10px;
  margin-right: 6px;
  border-radius: 2px;
  vertical-align: middle;
}
.legend .gt {
  background: rgba(34, 197, 94, 0.5);
  border: 1px solid #16a34a;
}
.legend .pred {
  background: rgba(59, 130, 246, 0.5);
  border: 1px solid #2563eb;
}
.legend .foot {
  background: rgba(251, 191, 36, 0.15);
  border: 1px dashed #fbbf24;
}
</style>
