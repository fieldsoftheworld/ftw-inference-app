<script setup lang="ts">
import MapComponent from '../components/MapComponent.vue'
import { mdiInformation } from '@mdi/js'
import { ref, watch } from 'vue'

const ftwAboutDialogShown = localStorage.getItem('ftw-about-dialog-shown') !== 'true'
const aboutDialog = ref(ftwAboutDialogShown)
const dontShowAgain = ref(!ftwAboutDialogShown)

watch(dontShowAgain, (newValue) => {
  localStorage.setItem('ftw-about-dialog-shown', String(newValue))
})
</script>

<template>
  <div class="map-view">
    <header id="title">
      Fields of The World: Inference App
      <v-btn
        density="compact"
        variant="plain"
        :icon="mdiInformation"
        @click="aboutDialog = true"
        title="About"
      ></v-btn>
    </header>

    <MapComponent />

    <!-- About Dialog -->
    <v-dialog v-model="aboutDialog" width="auto">
      <v-card max-width="600" border :prepend-icon="mdiInformation" title="About the Inference App">
        <v-card-text>
          Welcome to the Fields of the World (FTW) Web App. Use it to run the FTW model on
          Sentinel-2 imagery and generate predicted field boundaries for your chosen area of
          interest. To get started, either zoom in or click on your area of interest.
        </v-card-text>
        <v-card-actions>
          <v-checkbox-btn v-model="dontShowAgain" label="Don't show again"></v-checkbox-btn>
          <v-spacer></v-spacer>
          <v-btn variant="flat" color="primary" text="Ok" @click="aboutDialog = false"></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
#title {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 0.5rem 1rem;
  border-radius: 0 0 1rem 1rem;
  font-size: 1.33rem;
  font-weight: 600;
  white-space: nowrap;
}
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
