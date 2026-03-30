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
        height="64"
      />
      <v-btn
        density="compact"
        variant="plain"
        :icon="mdiInformation"
        @click="aboutDialog = true"
        title="About"
        class="info-btn"
      ></v-btn>
      <v-item-group
        selected-class="bg-primary"
        mandatory
        v-model="modeValue"
        @update:model-value="setModeValue"
      >
        <v-container>
          <v-row>
            <v-col
              v-for="tab in availableModes"
              :key="tab.id"
              cols="12"
              :md="12 / availableModes.length"
              class="mode-switch-col"
            >
              <v-item v-slot="{ selectedClass, toggle }">
                <v-card :class="['d-flex align-center', selectedClass]" @click="toggle">
                  <div class="mode-switch-btn flex-grow-1 text-center">{{ tab.label }}</div>
                </v-card>
              </v-item>
            </v-col>
          </v-row>
        </v-container>
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
  white-space: nowrap;
  min-width: 400px;
  text-align: center;
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
.mode-switch-col {
  padding: 0 0.25rem 0.25rem 0.25rem;
}
.mode-switch-btn {
  font-size: 1.1rem;
  padding: 0.25rem;
  white-space: nowrap;
}
.info-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 1001;
}
</style>
