<script setup lang="ts">
import Map from '../components/Map.vue'
</script>

<template>
  <div class="map-view">
    <Map />
  </div>
</template>

<style scoped>
.map-view {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 100%;
}
</style>
