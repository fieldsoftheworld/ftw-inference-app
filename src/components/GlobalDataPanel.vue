<script setup lang="ts">
import { computed } from 'vue'
import { mdiInformationOutline } from '@mdi/js'
import useSettings from '../composables/useSettings'
import useMap from '../composables/useMap'
import { getEffectiveCloudlessYear } from '../layers/S2-Cloudless-Layer'
import useAreaOfInterest from '../composables/useAreaOfInterest'
import type { PlaceResult } from '../composables/useAreaOfInterest'
import useNotifier from '../composables/useNotifier'
import useDownloadGrid from '../composables/useDownloadGrid'
import { transformExtent } from 'ol/proj'
import GeocodingSearch from './GeocodingSearch.vue'
import MapLegend from './MapLegend.vue'

const { settings, defaultSettings } = useSettings()
const { map } = useMap()

const basemapYearMismatch = computed(
  () => settings.value.year !== getEffectiveCloudlessYear(settings.value.year),
)
const thresholdMayHideFields = computed(() => settings.value.threshold >= 90)
const resetThreshold = () => {
  settings.value.threshold = defaultSettings.threshold
}
const { fitToExtent } = useAreaOfInterest()
const { showError } = useNotifier()
const { downloadFormat } = useDownloadGrid()

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
      Pre-computed agricultural field boundaries for <strong>2024</strong> and
      <strong>2025</strong>, generated globally with the
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
        >
      </v-menu>
      model.
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
        <v-alert
          v-if="basemapYearMismatch"
          type="info"
          variant="tonal"
          density="compact"
          class="mt-2 note"
        >
          Showing the {{ getEffectiveCloudlessYear(settings.year) }} basemap. The 2025 basemap will
          be added soon.
        </v-alert>
        <h3 class="group">
          Confidence Threshold: {{ settings.threshold }}%
          <v-menu open-on-hover :close-on-content-click="false" max-width="360">
            <template #activator="{ props }">
              <v-icon
                class="ml-2"
                :icon="mdiInformationOutline"
                size="small"
                v-bind="props"
              ></v-icon>
            </template>
            <v-sheet class="pa-3 text-body-2">
              Only show fields where the model's confidence meets this threshold. Higher values show
              fewer, more certain fields; lower values show more fields, including less certain
              ones.
            </v-sheet>
          </v-menu>
        </h3>
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
        <v-alert
          v-if="thresholdMayHideFields"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-2 note"
        >
          A high confidence threshold may hide most or all fields in this area.
          <v-btn @click="resetThreshold" size="small" class="mt-2"> Reset threshold </v-btn>
        </v-alert>
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
              <v-icon :icon="mdiInformationOutline" size="small" v-bind="props"></v-icon>
            </template>
            <v-sheet class="pa-3 text-body-2">
              <p class="pb-2">
                After activation, click a tile to download the agricultural field boundary
                predictions for that 1° cell as a GeoParquet or GeoJSON file. The confidence
                threshold and opacity settings do not affect the downloaded data; all fields
                predicted by the model for the selected cell and year will be included.
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
        <template v-if="settings.downloads">
          <v-radio-group v-model="downloadFormat" density="compact" hide-details inline>
            <v-radio label="GeoParquet" value="parquet"></v-radio>
            <v-radio label="GeoJSON" value="json"></v-radio>
          </v-radio-group>
          <p class="text-caption text-medium-emphasis mb-1">Click any grid cell to download.</p>
        </template>
        <h3 class="group legend">
          Legend
          <v-menu open-on-hover :close-on-content-click="false" max-width="360">
            <template #activator="{ props }">
              <v-icon
                class="ml-2"
                :icon="mdiInformationOutline"
                size="small"
                v-bind="props"
              ></v-icon>
            </template>
            <v-sheet class="pa-3 text-body-2">
              Zoomed out, the map shows <strong>field density</strong> (fields per area). Zoom in to
              see individual fields colored by the model's <strong>confidence</strong>.
            </v-sheet>
          </v-menu>
        </h3>
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
