<template>
  <v-card
    elevation="8"
    :class="{ closed: !isOpen, 'processing-results': true, sidebar: true }"
    :loading="isProjectLoading"
  >
    <v-card-title class="d-flex align-center justify-space-between pa-2">
      <div v-if="geoJsonResults.length > 0" class="collapse-action" @click="toggleCollapsible">
        <v-icon
          :class="{ 'rotate-180': isOpen }"
          class="mr-1 text-white transition-transform"
          :icon="mdiChevronDown"
        >
        </v-icon>
        <span class="text-white title"> Results ({{ geoJsonResults.length }}) </span>
      </div>
      <span v-else class="text-white title">Results</span>
      <v-spacer />

      <!-- Project List Dialog -->
      <v-dialog v-if="projects.length > 0" width="auto">
        <template v-slot:activator="{ props: activatorProps }">
          <v-btn variant="outlined" density="comfortable" color="primary" v-bind="activatorProps"
            >Load</v-btn>
        </template>
        <template v-slot:default="{ isActive }">
          <v-card title="Load Project">
            <ProcessList />
          
            <v-card-actions>
              <v-spacer></v-spacer>
            
              <v-btn
                text="Close Dialog"
                @click="isActive.value = false"
              ></v-btn>
            </v-card-actions>
          </v-card>
        </template>
      </v-dialog>
    </v-card-title>

    <v-card-text v-show="isOpen" class="content">
      <div class="settings">
        <v-expansion-panels>
          <v-expansion-panel title="Statistics" class="panel statistics">
            <v-expansion-panel-text>
              <div v-for="field in statFields" class="group" :key="field">
                <v-label class="text-capitalize mb-1">{{ field }}</v-label>
                <PropertiesDisplay :properties="statistics[field]" :units="statUnits[field]" />
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
          <v-expansion-panel title="Field Details" class="panel fields">
            <v-expansion-panel-text>
              <v-row>
                <v-col cols="12" class="d-flex align-center">
                  <v-select
                    class="w-50"
                    label="Sort by"
                    hide-details
                    outlined
                    :items="['Id', 'Area', 'Perimeter']"
                    v-model="sortKey"
                  ></v-select>
                  <v-select
                    class="w-50"
                    label="Sort order"
                    hide-details
                    outlined
                    :items="['ascending', 'descending']"
                    v-model="sortOrder"
                  ></v-select>
                </v-col>
              </v-row>

              <v-list density="compact" color="transparent" class="pa-0">
                <v-list-item
                  v-for="result in sortedResults"
                  :key="result.id"
                  class="result-item"
                  @click.stop="fitMapToResult(result)"
                >
                  <div class="result-properties">
                    <PropertiesDisplay :properties="result.properties" />
                  </div>
                </v-list-item>
              </v-list>
              <v-btn v-if="hasMoreResults" @click="limit += 50" class="action-button mt-4"
                >Show more
              </v-btn>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </div>

      <div class="action-buttons">
        <v-btn
          icon
          color="primary"
          variant="flat"
          @click.stop="returnToResultsHandler"
          class="action-button return-to-results"
          title="Zoom to results"
        >
          <v-icon :icon="mdiTarget"></v-icon>
        </v-btn>
        <v-btn class="action-button download-results" @click="downloadResults" density="comfortable"
          >Download</v-btn
        >
        <v-btn
          class="action-button clear-results"
          @click="clearResultsHandler"
          color="error"
          density="compact"
          >Clear</v-btn
        >
      </div>
    </v-card-text>

  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, onBeforeUnmount, computed, watch } from 'vue'
import useMap from '../composables/useMap'
import useNotifier from '../composables/useNotifier'
import useAreaOfInterest from '../composables/useAreaOfInterest'
import PropertiesDisplay from './PropertiesDisplay.vue'
import ProcessList from './ProcessList.vue'
import { mdiChevronDown, mdiTarget } from '@mdi/js'
import { type Feature } from 'geojson'
import useProcessing from '../composables/useProcessing'

const props = defineProps<{
  geoJsonResults: any[]
}>()

const emit = defineEmits<{
  (e: 'clearResults'): void
}>()

const { map, handleMapClick, vectorLayer, selectedFeature, hidePropertiesBox } = useMap()
const { clearResults, returnToResults, fitToExtent } = useAreaOfInterest()
const { showInfo, showError } = useNotifier()
const { isProjectLoading, projects } = useProcessing()

const isOpen = ref(false)
const limit = ref(50)

const sortKey = ref<'Id' | 'Area' | 'Perimeter'>('Id')
const sortOrder = ref<'ascending' | 'descending'>('ascending')

const hasMoreResults = computed(() => {
  return props.geoJsonResults.length > limit.value
})

watch(
  () => props.geoJsonResults,
  (results) => (isOpen.value = results.length > 0),
)

const sortedResults = computed(() => {
  return props.geoJsonResults
    .slice(0)
    .sort((a, b) => {
      let compareA, compareB
      switch (sortKey.value) {
        case 'Id':
          compareA = a.id
          compareB = b.id
          break
        default:
          const key = sortKey.value.toLowerCase()
          compareA = a.properties[key]
          compareB = b.properties[key]
      }

      let order = 0
      if (typeof compareA === 'string' || typeof compareB === 'string') {
        compareA = String(compareA)
        compareB = String(compareB)
        order = compareA.localeCompare(compareB)
      } else if (compareA < compareB) {
        order = -1
      } else if (compareA > compareB) {
        order = 1
      }
      if (sortOrder.value === 'descending') {
        order *= -1
      }
      return order
    })
    .slice(0, limit.value)
})

interface ResaultStats {
  count: number
  min: number
  mean: number | null
  max: number
  sum: number
}

const statFields: ('area' | 'perimeter')[] = ['area', 'perimeter']
const statUnits: Record<'area' | 'perimeter', (key: string | number) => string> = {
  area: (key) => (key === 'count' ? '' : 'ha'),
  perimeter: (key) => (key === 'count' ? '' : 'm'),
}

const statistics = computed(() => {
  const template: ResaultStats = { count: 0, min: Infinity, mean: 0, max: -Infinity, sum: 0 }
  const stats: Record<'area' | 'perimeter', ResaultStats> = {
    area: Object.assign({}, template),
    perimeter: Object.assign({}, template),
  }
  props.geoJsonResults.forEach((feature) => {
    for (const type of statFields) {
      const value = feature.properties[type]
      if (typeof value === 'number') {
        stats[type].count += 1
        stats[type].sum += value
        if (value < stats[type].min) stats[type].min = value
        if (value > stats[type].max) stats[type].max = value
      }
    }
  })

  for (const type of statFields) {
    const stat = stats[type]
    stat.mean = stat.count > 0 ? stat.sum / stat.count : null
  }
  return stats
})

const toggleCollapsible = () => {
  isOpen.value = !isOpen.value
}

const downloadResults = () => {
  if (!props.geoJsonResults || props.geoJsonResults.length === 0) {
    showInfo('No results to download.')
    return
  }

  try {
    // Create a GeoJSON FeatureCollection from the results
    const geojson = {
      type: 'FeatureCollection',
      features: props.geoJsonResults,
    }

    // Convert to JSON string
    const jsonString = JSON.stringify(geojson)

    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)

    // Create download link
    const link = document.createElement('a')
    link.href = url
    link.download = `processing-results-${new Date().toISOString().split('T')[0]}.geojson`

    // Trigger download
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading results:', error)
    showError('Failed to download results.')
  }
}

const fitMapToResult = (result: Feature) => {
  if (!result || !result.id) {
    showError('No valid geometry found for this result.')
    return
  }

  const resultFeature = vectorLayer.value?.getSource()?.getFeatureById(result.id)
  if (!resultFeature) {
    showError('Feature not found on the map.')
    return
  }

  hidePropertiesBox()

  // Highlight the result feature
  selectedFeature.value = resultFeature

  // Get the extent of the feature
  const extent = resultFeature.getGeometry()?.getExtent()

  fitToExtent(map.value!, extent, null)
}

onMounted(() => {
  // Add map click handler to detect feature clicks and show properties
  if (map.value) {
    map.value.on('singleclick', handleMapClick)
  }
})

onBeforeUnmount(() => {
  selectedFeature.value = null
})

// Clean up map click handler when component is unmounted
onUnmounted(() => {
  if (map.value) {
    map.value.un('singleclick', handleMapClick)
  }
})

const clearResultsHandler = () => {
  // Clear results and zoom back to S2 grid
  clearResults(map.value!)
  // Emit event to clear results in parent components
  emit('clearResults')
}

const returnToResultsHandler = () => {
  returnToResults(map.value!)
}
</script>

<style scoped>
.processing-results {
  right: 1em;
  max-height: calc(100vh - 3rem - 40px);
  min-width: 250px;
  width: 260px;
  max-width: 45vw;
}

.processing-results .v-list {
  background-color: transparent !important;
}

.result-item {
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 2px;
  margin-bottom: 2px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(0, 136, 136, 0.6);
}

.result-item:last-child {
  border-bottom: none !important;
}

.result-properties {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

:deep(.panel.fields .v-expansion-panel-text__wrapper) {
  padding: 0;
}

.group {
  margin-bottom: 1rem;
}
.group:last-child {
  margin-bottom: 0;
}
</style>
