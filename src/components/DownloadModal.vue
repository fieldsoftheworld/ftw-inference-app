<script setup lang="ts">
import { computed } from 'vue'
import type { GridCell } from '../composables/useDownloadGrid'
import useSettings from '../composables/useSettings'
import { getDownloadParquetUrl } from '../layers/Download-Grid-Layer'

const props = defineProps<{
  modelValue: boolean
  cell: GridCell | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { settings } = useSettings()

const hasDataForYear = computed(() =>
  props.cell ? props.cell.years.includes(settings.value.year) : false,
)

const cellLabel = computed(() => {
  if (!props.cell) return ''
  const { lat_min, lon_min } = props.cell
  const south = lat_min
  const north = lat_min + 1
  const west = lon_min
  const east = lon_min + 1
  const fmtLat = (v: number) => `${Math.abs(v)}°${v >= 0 ? 'N' : 'S'}`
  const fmtLon = (v: number) => `${Math.abs(v)}°${v >= 0 ? 'E' : 'W'}`
  return `${fmtLat(south)}–${fmtLat(north)}, ${fmtLon(west)}–${fmtLon(east)}`
})

const downloadUrl = computed(() =>
  props.cell ? getDownloadParquetUrl(settings.value.year, props.cell.tile_id) : '',
)

const featureCount = computed(() => props.cell?.feature_count ?? null)
const sizeMb = computed(() =>
  props.cell?.size_bytes ? (props.cell.size_bytes / (1024 * 1024)).toFixed(1) : null,
)

const close = () => emit('update:modelValue', false)
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card v-if="cell" class="download-modal">
      <v-card-title class="d-flex align-center justify-space-between pa-4">
        <span class="modal-title">Download Field Data</span>
        <v-btn icon variant="plain" color="teal" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <v-card-text class="pa-4">
        <div class="tile-info mb-4">
          <v-chip color="teal" variant="outlined" size="small" class="me-2">
            {{ cell.tile_id }}
          </v-chip>
          <span class="text-caption text-medium-emphasis">{{ cellLabel }}</span>
        </div>

        <p class="text-body-2 text-medium-emphasis mb-4">
          Download {{ settings.year }} agricultural field boundary predictions for this 1° × 1° tile
          as a <strong>GeoParquet</strong> file. Data is hosted on
          <a href="https://source.coop" target="_blank" rel="noopener" class="text-teal"
            >Source Cooperative</a
          >.
        </p>

        <div v-if="hasDataForYear && (featureCount || sizeMb)" class="tile-stats text-caption mb-0">
          <span v-if="featureCount !== null">
            <strong>{{ featureCount.toLocaleString() }}</strong> field boundaries
          </span>
          <span v-if="featureCount !== null && sizeMb" class="mx-2">·</span>
          <span v-if="sizeMb"
            ><strong>{{ sizeMb }} MB</strong></span
          >
        </div>

        <v-alert v-if="!hasDataForYear" type="warning" density="compact" class="mb-0">
          No {{ settings.year }} data is available for this tile. Choose a different year in the
          side panel, or select another tile.
        </v-alert>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4 d-flex justify-end gap-2">
        <v-btn variant="text" color="grey" @click="close">Cancel</v-btn>
        <v-btn
          color="teal"
          variant="flat"
          :href="downloadUrl"
          :download="`ftw-fields-${cell.tile_id}-${settings.year}.parquet`"
          :disabled="!hasDataForYear"
          target="_blank"
          rel="noopener"
          prepend-icon="mdi-download"
        >
          Download GeoParquet
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.download-modal {
  background-color: rgba(10, 10, 10, 0.97);
  border: 1px solid rgba(0, 136, 136, 0.4);
}

.modal-title {
  color: rgba(0, 136, 136, 1);
  font-size: 1.1rem;
  font-weight: 600;
}

.tile-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
