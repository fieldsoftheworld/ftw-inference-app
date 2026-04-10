<script setup lang="ts">
import MapComponent from '../components/MapComponent.vue'
import { mdiInformation } from '@mdi/js'
import { ref, watch } from 'vue'
import useSettings from '../composables/useSettings'

const { settings, availableModes } = useSettings()

const ftwAboutDialogShown = localStorage.getItem('ftw-about-dialog-shown') !== 'true'
const aboutDialog = ref(ftwAboutDialogShown)
const dontShowAgain = ref(!ftwAboutDialogShown)

watch(dontShowAgain, (newValue) => {
  localStorage.setItem('ftw-about-dialog-shown', String(newValue))
})

const modeValue = ref(0)
watch(
  () => settings.value.mode,
  (mode) => {
    const index = availableModes.findIndex((m) => m.id === mode)
    if (index !== -1) {
      modeValue.value = index
    }
  },
  { immediate: true },
)

function setModeValue(newValue: number) {
  settings.value.mode = availableModes[newValue].id
}
</script>

<template>
  <div class="map-view">
    <header id="title">
      <img
        src="https://fieldsofthe.world/static/images/brand/logos/ftw-logo-light.svg"
        alt="Fields of The World (FTW) App"
        class="logo"
        @click="aboutDialog = true"
      />
      <v-item-group
        selected-class="bg-primary"
        mandatory
        v-model="modeValue"
        @update:model-value="setModeValue"
        class="mode-switch"
      >
        <v-item v-for="tab in availableModes" :key="tab.id" v-slot="{ selectedClass, toggle }">
          <v-card :class="['d-flex align-center', selectedClass]" @click="toggle">
            <div class="mode-switch-btn flex-grow-1 text-center">{{ tab.label }}</div>
          </v-card>
        </v-item>
      </v-item-group>
    </header>

    <MapComponent />

    <!-- About Dialog -->
    <v-dialog v-model="aboutDialog" width="auto">
      <v-card max-width="600" border :prepend-icon="mdiInformation" title="About the App">
        <v-card-text>
          Welcome to the Fields of the World (FTW) Web App. Use it to either explore the global
          field boundary data or run the FTW model on Sentinel-2 Level 2A Collection 1 imagery. Both
          allow you to visualize predicted field boundaries for your chosen area of interest. To get
          started, choose your area of interest on the map.
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
  padding: 0.25rem 0.5rem 0.5rem 0.5rem;
  border-radius: 0 0 1rem 1rem;
  font-size: 1.33rem;
  font-weight: 600;
  text-align: center;
}

#title .logo {
  height: 64px;
  cursor: pointer;
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

.mode-switch {
  display: flex;
  gap: 0.5rem;
}

.mode-switch-btn {
  font-size: 1.1rem;
  padding: 0.2rem 0.5rem;
  white-space: nowrap;
}
.info-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 1001;
}

@media (width <= 1200px) {
  #title {
    display: flex;
  }
  #title .logo {
    height: 40px;
  }
  .mode-switch-btn {
    font-size: 1rem;
  }
}
</style>
