<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Map, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import DataCabinet from './DataCabinet.vue'
import createS2GridLayer from '../layers/S2-Grid-Layer.ts'
import ExtentInteraction from 'ol/interaction/Extent'
import { shiftKeyOnly } from 'ol/events/condition'
import { Extent } from 'ol/extent'
import { Style, Fill, Stroke } from 'ol/style'
import createCloudlessLayer from '../layers/S2-Cloudless-Layer.ts'

const map = ref<Map | null>(null)
const dataCabinetRef = ref<InstanceType<typeof DataCabinet> | null>(null)
const selectedTileExtent = ref<Extent | null>(null)
let extentInteraction: ExtentInteraction | null = null

// Function to handle extent changes
const handleExtentChange = (extent: Extent) => {
  if (dataCabinetRef.value) {
    dataCabinetRef.value.setDrawnExtent(extent)
  }
}

// Function to set the selected tile extent
const setSelectedTileExtent = (extent: Extent) => {
  selectedTileExtent.value = extent

  // Remove existing extent interaction if any
  if (extentInteraction && map.value) {
    map.value.removeInteraction(extentInteraction)
    extentInteraction = null
  }

  // Create and add new extent interaction
  if (map.value) {
    extentInteraction = new ExtentInteraction({
      condition: shiftKeyOnly,
      extent: extent, // Constrain the extent to the selected tile
      boxStyle: new Style({
        stroke: new Stroke({
          color: 'rgba(0, 136, 136, 1)',
          width: 2
        }),
        fill: new Fill({
          color: 'rgba(0, 136, 136, 0.2)'
        })
      })
    })

    // Add event listener for extent changes
    extentInteraction.on('extentchanged', (event) => {
      handleExtentChange(event.extent)
    })

    map.value.addInteraction(extentInteraction)
  }
}

// Function to clear the selected tile
const clearSelectedTile = () => {
  selectedTileExtent.value = null
  if (extentInteraction && map.value) {
    map.value.removeInteraction(extentInteraction)
    extentInteraction = null
  }
}

onMounted(() => {
  map.value = new Map({
    target: 'map',
    layers: [
      createCloudlessLayer()
    ],
    view: new View({
      center: [0, 0],
      zoom: 2,
    }),
  });

  // Add S2 Grid layer after map is initialized
  if (map.value) {
    const s2GridLayer = createS2GridLayer(map.value, dataCabinetRef, setSelectedTileExtent, clearSelectedTile);
    map.value.addLayer(s2GridLayer);
  }
})

// Expose methods to parent components
defineExpose({
  setSelectedTileExtent,
  clearSelectedTile
})
</script>

<template>
  <div class="map-wrapper">
    <div id="map" class="map-container"></div>
    <DataCabinet :map="map" ref="dataCabinetRef" />
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
  color: #FFF;
}

:deep(.ol-zoom button:hover) {
  background-color: rgba(0, 0, 0, 0.8);
  color: #FFF;
}

:deep(.ol-attribution button) {
  background-color: rgba(0, 0, 0, 0.6);
  color: #FFF;
}

:deep(.ol-attribution) {
  background-color: rgba(0, 0, 0, 0.8);
  color: #FFF;
}

:deep(.ol-attribution ul) {
  color: #FFF;
  font-size: 0.875rem;
  text-shadow: none;
}

:deep(.ol-attribution ul li a) {
  color: #FFF;
}
</style>
