<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Map, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import DataCabinet from './DataCabinet.vue'
import createS2GridLayer from '../layers/S2-Grid-Layer.ts'
const map = ref<Map | null>(null)

onMounted(async () => {
  map.value = new Map({
    target: 'map',
    layers: [
      new TileLayer({
        source: new XYZ({
          url: 'https://tiles.maps.eox.at/wmts?layer=s2cloudless-2024_3857&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fjpeg&TileMatrix={z}&TileCol={x}&TileRow={y}',
          maxZoom: 19,
          tileSize: 256,
          attributions: 'Sentinel-2 cloudless imagery by <a href="https://eox.at">EOX</a>'
        }),
      }),
    ],
    view: new View({
      center: [0, 0],
      zoom: 2,
    }),
  })
  map.value.on('load', async () => {
    await createS2GridLayer(map.value)
  })
})
</script>

<template>
  <div class="map-wrapper">
    <div id="map" class="map-container"></div>
    <DataCabinet />
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
