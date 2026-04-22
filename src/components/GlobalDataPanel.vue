<script setup lang="ts">
import { mdiHelpCircleOutline } from '@mdi/js'
import useSettings from '../composables/useSettings'
import useMap from '../composables/useMap'
import useAreaOfInterest from '../composables/useAreaOfInterest'
import type { PlaceResult } from '../composables/useAreaOfInterest'
import useNotifier from '../composables/useNotifier'
import useDownloadGrid from '../composables/useDownloadGrid'
import { transformExtent } from 'ol/proj'
import GeocodingSearch from './GeocodingSearch.vue'
import MapLegend from './MapLegend.vue'

const { settings } = useSettings()
const { map } = useMap()
const { fitToExtent } = useAreaOfInterest()
const { showError } = useNotifier()
useDownloadGrid()

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
    <v-alert density="compact" color="gray" class="mb-2 introduction">
      The <strong>global predictions</strong> provide global-scale estimates of agricultural fields
      for 2024 and 2025. They were computed using the model
      <v-menu open-on-hover :close-on-content-click="false" max-width="400">
        <template #activator="{ props }">
          <strong v-bind="props" style="cursor: pointer; text-decoration: underline dotted"
            >FTW v3: CC-BY, B7</strong
          >
        </template>
        <v-sheet class="pa-3 text-body-2"
          >Please refer to our paper "<a
            href="https://arxiv.org/abs/2603.27101"
            target="_blank"
            rel="noopener"
            >PRUE: A Practical Recipe for Field Boundary Segmentation at Scale</a
          >" for more information. The model version "FTW v3" is also named "PRUE" in the
          paper.</v-sheet
        > </v-menu
      >.
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
        <h3 class="group">Confidence Threshold: {{ settings.threshold }}%</h3>
        <v-slider
          v-model.number="settings.threshold"
          :min="0"
          :max="100"
          :step="1"
          color="teal"
          track-color="grey-darken-2"
          thumb-color="teal"
          hide-details
        />
        <h3 class="group">Opacity: {{ settings.opacity }}%</h3>
        <v-slider
          v-model.number="settings.opacity"
          :min="0"
          :max="100"
          :step="1"
          color="teal"
          track-color="grey-darken-2"
          thumb-color="teal"
          hide-details
        />
        <div class="group group-with-help">
          <h3>Download Data</h3>
          <v-menu open-on-hover :close-on-content-click="false" max-width="400">
            <template #activator="{ props }">
              <v-icon :icon="mdiHelpCircleOutline" size="x-small" v-bind="props"></v-icon>
            </template>
            <v-sheet class="pa-3 text-body-2">
              <p class="pb-2">
                After activation, click a tile to download the agricultural field boundary
                predictions for that 1° cell as a GeoParquet file.
              </p>
              <p>
                You can also download the entire dataset in various variants from
                <a href="https://source.coop/ftw/global-data/" target="_blank" rel="noopener"
                  >our Source Cooperative repository</a
                >.
              </p>
            </v-sheet>
          </v-menu>
        </div>
        <v-switch
          v-model="settings.downloads"
          color="teal"
          density="compact"
          hide-details
          label="Show download grid"
          class="mb-1"
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
.group-with-help {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.group-with-help h3 {
  margin: 0;
  font-weight: inherit;
  font-size: inherit;
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
