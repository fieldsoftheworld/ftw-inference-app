<script setup lang="ts">
import { ref, onMounted, shallowRef } from 'vue'
import { Map, View } from 'ol'
import DataCabinet from './DataCabinet.vue'
import Snackbar from './Snackbar.vue'
import ProcessingResults from './ProcessingResults.vue'
import createS2GridLayer from '../layers/S2-Grid-Layer'
import createCloudlessLayer from '../layers/S2-Cloudless-Layer'
import { generateJWT } from '../functions/generate-jwt'
import { useAreaOfInterest } from '../composables/useAreaOfInterest'
import { useSearch } from '../composables/useSearch'
import { usePermalink } from '../composables/usePermalink'

const map = shallowRef<Map | null>(null)
const dataCabinetRef = ref<InstanceType<typeof DataCabinet> | null>(null)
const areaValues = ref<{ min_area_km2: number; max_area_km2: number } | null>(null)
const geoJSONResults = ref<any[]>([])

const {
  addMapClickHandler,
  drawnExtent,
  currentMgrsTileId,
  activeTileId,
  secondActiveTileId,
  triggerTileSelection,
} = useAreaOfInterest()
const { searchResults, handleSearchResults } = useSearch()
const { setupPermalink } = usePermalink()

const updateGeoJSONResults = (results: any[]) => {
  geoJSONResults.value = results
}

const clearResults = () => {
  geoJSONResults.value = []
}

onMounted(async () => {
  map.value = new Map({
    target: 'map',
    layers: [createCloudlessLayer()],
    view: new View({
      center: [0, 0],
      zoom: 2,
    }),
  })

  // Get area values from API
  try {
    const token = generateJWT()
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
    const response = await fetch(`${apiBaseUrl}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch area values: ${response.statusText}`)
    }
    const data = await response.json()
    areaValues.value = {
      min_area_km2: data.min_area_km2 ?? 100,
      max_area_km2: data.max_area_km2 ?? 500,
    }
  } catch (error) {
    areaValues.value = {
      min_area_km2: 500,
      max_area_km2: 100,
    }
    console.error('Error fetching area values:', error)
  }

  // Add S2 Grid layer after map is initialized
  if (map.value) {
    const s2GridLayer = createS2GridLayer()
    addMapClickHandler(
      map.value as Map,
      dataCabinetRef,
      areaValues.value,
      searchResults,
      handleSearchResults,
    )
    map.value.addLayer(s2GridLayer)

    // Setup permalink functionality
    setupPermalink(
      map.value,
      currentMgrsTileId,
      activeTileId,
      secondActiveTileId,
      (mgrsTileId: string) => {
        // This callback will be called when a permalink is loaded with a tile ID
        // It will automatically trigger the search and tile selection
        triggerTileSelection(
          map.value!,
          mgrsTileId,
          dataCabinetRef,
          areaValues.value!,
          handleSearchResults,
        )
      },
    )
  }
})

// Expose methods to parent components
defineExpose({
  areaValues,
  updateGeoJSONResults,
})
</script>

<template>
  <div class="map-wrapper">
    <div id="map" class="map-container"></div>
    <DataCabinet
      v-if="map"
      :map="map as Map"
      :areaValues="areaValues!"
      ref="dataCabinetRef"
      @updateGeoJSONResults="updateGeoJSONResults"
    />
    <ProcessingResults
      v-if="map"
      :map="map as Map"
      :geoJSONResults="geoJSONResults"
      @clearResults="clearResults"
    />
    <Snackbar />
  </div>
</template>

<style scoped>
.map-wrapper {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
}

.map-container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
}

:deep(.ol-zoom) {
  top: unset;
  bottom: 0.625rem;
  left: 0.625rem;
}

:deep(.ol-zoom button) {
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
}

:deep(.ol-zoom button:hover) {
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
}

:deep(.ol-attribution button) {
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
}

:deep(.ol-attribution) {
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
}

:deep(.ol-attribution ul) {
  color: #fff;
  font-size: 0.875rem;
  text-shadow: none;
}

:deep(.ol-attribution ul li a) {
  color: #fff;
}
</style>
