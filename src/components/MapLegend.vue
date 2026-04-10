<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { mdiMapLegend } from '@mdi/js'
import useSettings from '../composables/useSettings'
import { GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL } from '../composables/useSettings'
import { map, geoJsonResults } from '../composables/useMap'
import {
  areaColorScale,
  confidenceColorScale,
  globalPredictionsStyle,
  inferenceStyle,
} from '../layers/color-scales'

const { settings } = useSettings()

const collapsed = ref(true)
const zoom = ref(0)

const onZoomChange = () => {
  zoom.value = map.value?.getView()?.getZoom() ?? 0
}

onMounted(() => {
  if (map.value) {
    onZoomChange()
    map.value.getView().on('change:resolution', onZoomChange)
  }
})

onUnmounted(() => {
  map.value?.getView()?.un('change:resolution', onZoomChange)
})

const showFields = computed(() => zoom.value >= GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL)
const hasInferenceResults = computed(() => geoJsonResults.value.length > 0)

const stops = computed(() =>
  settings.value.aggregate === 'confidence' ? confidenceColorScale : areaColorScale,
)
const title = computed(() =>
  settings.value.aggregate === 'confidence' ? 'Confidence (%)' : 'Field Area (%)',
)

const isConfidence = computed(() => settings.value.aggregate === 'confidence')

// Compute threshold position based on evenly-spaced stop indices (matching label layout)
const thresholdPct = computed(() => {
  if (!isConfidence.value) return 0
  const s = stops.value
  const threshold = settings.value.threshold
  const n = s.length - 1
  // Find which segment the threshold falls in
  for (let i = 0; i < n; i++) {
    if (threshold <= s[i].value) return (i / n) * 100
    if (threshold <= s[i + 1].value) {
      const frac = (threshold - s[i].value) / (s[i + 1].value - s[i].value)
      return ((i + frac) / n) * 100
    }
  }
  return 100
})

const rampStyle = computed(() => {
  // Always use evenly-spaced full ramp
  const s = stops.value
  const n = s.length - 1
  const colorStops = s.map((stop, i) => `${stop.color} ${(i / n) * 100}%`)
  return { background: `linear-gradient(to right, ${colorStops.join(', ')})` }
})
</script>

<template>
  <div
    v-if="settings.mode === 'global'"
    class="ol-legend ol-unselectable ol-control"
    :class="{ 'ol-collapsed': collapsed }"
  >
    <button
      type="button"
      :title="collapsed ? 'Show legend' : 'Hide legend'"
      @click="collapsed = !collapsed"
    >
      <svg viewBox="0 0 24 24" width="1em" height="1em">
        <path :d="mdiMapLegend" fill="currentColor" />
      </svg>
    </button>
    <div v-show="!collapsed" class="ol-legend-content">
      <!-- Global predictions swatch (zoomed in) -->
      <div v-if="settings.mode === 'global' && showFields" class="ol-legend-item">
        <span
          class="ol-legend-swatch"
          :style="{
            backgroundColor: globalPredictionsStyle.fill,
            borderColor: globalPredictionsStyle.stroke,
          }"
        ></span>
        <span>{{ globalPredictionsStyle.label }}</span>
      </div>
      <!-- Inference results swatch -->
      <div v-if="hasInferenceResults" class="ol-legend-item">
        <span
          class="ol-legend-swatch"
          :style="{
            backgroundColor: inferenceStyle.fill,
            borderColor: inferenceStyle.stroke,
          }"
        ></span>
        <span>{{ inferenceStyle.label }}</span>
      </div>
      <!-- Overview ramp legend (global mode, zoomed out) -->
      <template v-if="settings.mode === 'global' && settings.aggregate && !showFields">
        <div class="ol-legend-title">{{ title }}</div>
        <div class="ol-legend-bar">
          <div class="ol-legend-bar-ramp" :style="rampStyle"></div>
          <div
            v-if="isConfidence && thresholdPct > 0"
            class="ol-legend-bar-transparent"
            :style="{ width: thresholdPct + '%' }"
          ></div>
        </div>
        <div class="ol-legend-labels">
          <span v-for="(stop, i) in stops" :key="i">{{ stop.label }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ol-legend {
  position: absolute;
  bottom: calc(2rem + 6px);
  left: calc(2rem + 10px);
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  z-index: 10000;
}

.ol-legend button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.375em;
  height: 1.375em;
  margin: 1px;
  padding: 0;
  border: none;
  border-radius: 2px;
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 1em;
  font-weight: bold;
  cursor: pointer;
  line-height: 1;
}

.ol-legend button:hover {
  background-color: rgba(0, 0, 0, 1);
}

.ol-legend-content {
  margin-left: 0.5em;
  padding: 0.5em 0.75em;
  background-color: rgba(0, 0, 0, 0.8);
  border-radius: 4px;
  color: #fff;
  font-size: 0.8rem;
  min-width: 180px;
}

.ol-legend-title {
  font-weight: 600;
  margin-bottom: 0.35em;
  text-align: center;
}

.ol-legend-bar {
  position: relative;
  display: flex;
  height: 12px;
  border-radius: 2px;
  width: 100%;
  overflow: hidden;
}

.ol-legend-bar-transparent {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: repeating-linear-gradient(
    45deg,
    rgba(0, 0, 0, 1),
    rgba(0, 0, 0, 1) 3px,
    rgba(60, 60, 60, 1) 3px,
    rgba(60, 60, 60, 1) 6px
  );
  z-index: 1;
}

.ol-legend-bar-ramp {
  width: 100%;
  height: 100%;
}

.ol-legend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 0.2em;
  font-size: 0.7rem;
  opacity: 0.85;
}

.ol-legend-item {
  display: flex;
  align-items: center;
  gap: 0.5em;
  white-space: nowrap;
}

.ol-legend-swatch {
  display: inline-block;
  width: 16px;
  height: 12px;
  border: 2px solid;
  border-radius: 2px;
  flex-shrink: 0;
}
</style>
