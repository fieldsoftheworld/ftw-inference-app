<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Map, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'

const map = ref<Map | null>(null)

onMounted(() => {
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
})
</script>

<template>
  <div id="map" class="map-container"></div>
</template>

<style scoped>
:deep(.ol-control button){
  background-color: rgba(0, 0, 0, 0.6);
  color: #FFF;
}
:deep(.ol-control button:hover){
  background-color: rgba(0, 0, 0, 0.8);
  color: #FFF;
}
:deep(.ol-attribution){
  background-color: rgba(0, 0, 0, 0.6);
  color: #FFF;
}
:deep(.ol-attribution ul){
  color: #FFF;
  font-size: 0.875rem;
  text-shadow: none
}
:deep(.ol-attribution ul li a){
  color: #FFF;
}
</style>
