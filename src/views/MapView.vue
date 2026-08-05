<script setup lang="ts">
import MapComponent from '../components/MapComponent.vue'
import { ref, watch } from 'vue'
import useSettings from '../composables/useSettings'
import useLocationSearchFocus from '../composables/useLocationSearchFocus'

const { settings, availableModes } = useSettings()
const { requestLocationSearchFocus } = useLocationSearchFocus()

const getDontShowAgainStored = () => localStorage.getItem('ftw-about-dialog-shown') === 'true'

const dontShowAgain = ref(getDontShowAgainStored())
const aboutDialog = ref(!dontShowAgain.value)

function openAboutDialog() {
  dontShowAgain.value = getDontShowAgainStored()
  aboutDialog.value = true
}

function closeAboutDialog() {
  localStorage.setItem('ftw-about-dialog-shown', String(dontShowAgain.value))
  aboutDialog.value = false
}

watch(aboutDialog, (isOpen, wasOpen) => {
  if (!isOpen && wasOpen) {
    // Wait out Vuetify's dialog close transition + focus-restore, or our
    // focus call gets immediately overridden by it.
    setTimeout(requestLocationSearchFocus, 300)
  }
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
        alt="Fields of The World (FTW) Explorer"
        class="logo"
        @click="openAboutDialog"
      />
      <v-card variant="outlined" rounded="lg" class="switch">
        <span class="switch-label">Mode</span>
        <v-divider vertical></v-divider>
        <v-btn-toggle
          v-model="modeValue"
          mandatory
          divided
          color="primary"
          rounded="0"
          @update:model-value="setModeValue"
        >
          <v-btn v-for="(tab, index) in availableModes" :key="tab.id" :value="index">
            {{ tab.label }}
          </v-btn>
        </v-btn-toggle>
      </v-card>
    </header>

    <MapComponent />

    <!-- About Dialog -->
    <v-dialog v-model="aboutDialog" width="auto">
      <v-card max-width="600" title="Welcome to the Fields of The World (FTW) Explorer">
        <v-card-text>
          <p class="mb-2">This app has two modes, switched at the top of the screen:</p>
          <ul class="ps-5 mb-0">
            <li class="mb-2">
              <p class="mb-1">
                <strong>Global:</strong> Browse pre-computed global field boundaries for 2024 and
                2025. Zoom in to explore individual fields, or download a 1° tile as GeoParquet.
              </p>
              <p class="mb-0">
                Rate the field boundaries you see — your feedback helps improve the model.
              </p>
            </li>
            <li>
              <strong>Custom:</strong> Run the FTW model on-demand over an area you choose, using
              Sentinel-2 Level 2A imagery.
            </li>
          </ul>
          <p class="mt-3 mb-0">Ready to explore? Try searching for a region.</p>
        </v-card-text>
        <v-card-actions>
          <v-checkbox-btn v-model="dontShowAgain" label="Don't show again"></v-checkbox-btn>
          <v-spacer></v-spacer>
          <v-btn variant="flat" color="primary" text="Ok" @click="closeAboutDialog"></v-btn>
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
  padding: 0 0.5rem;
  border-radius: 0 0 1rem 1rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

#title .logo {
  height: 3.5rem;
  cursor: pointer;
}

#title .switch {
  margin: 0.25rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  overflow: hidden;
  background: transparent;
}

#title .switch-label {
  padding: 0 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  height: 100%;
  display: flex;
  align-items: center;
  border-right: 1px solid rgba(255, 255, 255, 0.7);
}

#title .switch :deep(.v-btn) {
  padding: 0 0.75rem;
  min-width: unset;
}

#title .switch :deep(.bg-primary) {
  --v-theme-overlay-multiplier: 0;
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

.info-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 1001;
}
</style>
