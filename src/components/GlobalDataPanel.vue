<script setup lang="ts">
import useSettings from '../composables/useSettings'
import useMap from '../composables/useMap'
import useAreaOfInterest from '../composables/useAreaOfInterest'
import type { PlaceResult } from '../composables/useAreaOfInterest'
import useNotifier from '../composables/useNotifier'
import { transformExtent } from 'ol/proj'
import GeocodingSearch from './GeocodingSearch.vue'
import MapLegend from './MapLegend.vue'

const { settings } = useSettings()
const { map } = useMap()
const { fitToExtent } = useAreaOfInterest()
const { showError } = useNotifier()

const handleLocationSelected = (place: PlaceResult) => {
  if (!map.value) return
  if (!place.boundingbox) {
    showError('Selected place does not have a bounding box.')
    return
  }
  const [south, north, west, east] = place.boundingbox.map(Number)
  const extent = transformExtent([west, south, east, north], 'EPSG:4326', 'EPSG:3857')
  fitToExtent(map.value, extent, 0, 15)
}
</script>

<template>
  <div class="settings">
    <v-alert density="compact" type="info" color="gray" class="mb-2">
      The <strong>global predictions</strong> provide global-scale estimates of agricultural fields
      for 2024 and 2025. They were computed using the model <strong>FTW v3: CC-BY, B7</strong>.
    </v-alert>

    <v-row class="d-flex justify-center w-100 mx-auto mb-0">
      <v-col>
        <h3 class="group">Location</h3>
        <GeocodingSearch @location-selected="handleLocationSelected" />
        <h3 class="group">Year</h3>
        <v-radio-group v-model="settings.year" density="compact" hide-details inline>
          <v-radio label="2024" :value="2024"></v-radio>
          <v-radio label="2025" :value="2025"></v-radio>
        </v-radio-group>
        <h3 class="group">Confidence Threshold: {{ (settings.threshold * 100).toFixed(0) }}%</h3>
        <v-slider
          v-model.number="settings.threshold"
          :min="0"
          :max="1"
          :step="0.01"
          color="teal"
          track-color="grey-darken-2"
          thumb-color="teal"
          hide-details
        />
        <h3 class="group legend">Legend</h3>
        <MapLegend />
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.group {
  margin: 1rem -0.5rem 0.5rem;
  font-weight: 500;
  font-size: 1.1rem;
}
.group.legend {
  margin-top: 1rem;
  border-top: 1px solid rgba(136, 136, 136, 0.65);
  padding-top: 1rem;
}
:deep(.v-selection-control-group--inline) {
  gap: 1rem;
}
</style>
