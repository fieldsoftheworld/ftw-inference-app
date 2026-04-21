<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import useMap from '../composables/useMap'
import useSettings from '../composables/useSettings'
import { GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL } from '../composables/useSettings'
import { areaColorScale, confidenceColorScale, inferenceStyle } from '../layers/color-scales'

const { settings } = useSettings()
const { map, geoJsonResults } = useMap()

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

// When zoomed in, always use the confidence scale; zoomed out, use the area scale
const legendStops = computed(() => (showFields.value ? confidenceColorScale : areaColorScale))
const legendTitle = computed(() => (showFields.value ? 'Confidence (%)' : 'Field Density (%)'))
const legendShowThreshold = computed(() => showFields.value)

const legendRampGradient = computed(() => {
  const s = legendStops.value
  const n = s.length - 1
  const colorStops = s.map((stop, i) => `${stop.color} ${(i / n) * 100}%`)
  return `linear-gradient(to right, ${colorStops.join(', ')})`
})

const legendThresholdPct = computed(() => {
  if (!legendShowThreshold.value) return 0
  const s = legendStops.value
  const threshold = settings.value.threshold
  const n = s.length - 1
  const labelValues = s.map((stop) => Number(stop.label))
  for (let i = 0; i < n; i++) {
    if (threshold <= labelValues[i]) return (i / n) * 100
    if (threshold <= labelValues[i + 1]) {
      const frac = (threshold - labelValues[i]) / (labelValues[i + 1] - labelValues[i])
      return ((i + frac) / n) * 100
    }
  }
  return 100
})
</script>

<template>
  <div class="legend">
    <!-- Inference results swatch -->
    <div v-if="hasInferenceResults" class="legend-item">
      <span
        class="legend-swatch"
        :style="{
          backgroundColor: inferenceStyle.fill,
          borderColor: inferenceStyle.stroke,
        }"
      ></span>
      <span>{{ inferenceStyle.label }}</span>
    </div>
    <!-- Global fields swatch -->
    <div v-if="showFields" class="legend-item">
      <span
        class="legend-swatch"
        :style="{
          background: 'transparent',
          borderImage: `${legendRampGradient} 2`,
        }"
      ></span>
      <span>Global Predictions</span>
    </div>
    <!-- Color ramp legend -->
    <div class="legend-title" :class="{ showFields }">
      <template v-if="showFields">with colors based on confidence:</template>
      <template v-else>{{ legendTitle }}</template>
    </div>
    <div class="legend-bar">
      <div class="legend-bar-ramp" :style="{ background: legendRampGradient }"></div>
      <div
        v-if="legendThresholdPct > 0"
        class="legend-bar-transparent"
        :style="{ width: legendThresholdPct + '%' }"
      ></div>
    </div>
    <div class="legend-labels">
      <span
        v-for="(stop, i) in legendStops"
        :key="i"
        :style="{
          left: (i / (legendStops.length - 1)) * 100 + '%',
          transform:
            i === 0
              ? 'none'
              : i === legendStops.length - 1
                ? 'translateX(-100%)'
                : 'translateX(-50%)',
        }"
        >{{ stop.label }}</span
      >
    </div>
  </div>
</template>

<style scoped>
.legend {
  margin-top: 0.5rem;
  padding: 0.5em 0;
  font-size: 0.85rem;
}

.legend-title {
  font-weight: 600;
  margin-bottom: 0.35em;
  text-align: center;
}
.legend-title.showFields {
  font-weight: 500;
  text-align: left;
}

.legend-bar {
  position: relative;
  display: flex;
  height: 12px;
  border-radius: 2px;
  width: 100%;
  overflow: hidden;
}

.legend-bar-transparent {
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

.legend-bar-ramp {
  width: 100%;
  height: 100%;
}

.legend-labels {
  position: relative;
  height: 1.2em;
  margin-top: 0.2em;
  font-size: 0.7rem;
  opacity: 0.85;
}

.legend-labels span {
  position: absolute;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5em;
  white-space: nowrap;
  margin-bottom: 0.35em;
}

.legend-swatch {
  display: inline-block;
  width: 16px;
  height: 12px;
  border: 2px solid;
  border-radius: 2px;
  flex-shrink: 0;
}
</style>
