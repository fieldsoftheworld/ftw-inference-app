<script setup lang="ts">
import { mdiChevronDown } from '@mdi/js'
import { ref } from 'vue'
import useSearch from '../composables/useSearch'
import useSettings from '../composables/useSettings'
import useMap from '../composables/useMap'
import useDownloadGrid from '../composables/useDownloadGrid'
import ProcessingPanel from './ProcessingPanel.vue'
import GlobalDataPanel from './GlobalDataPanel.vue'

const { searchStatus } = useSearch()
const { settings } = useSettings()
const { isLayerLoading } = useMap()
const { isConverting } = useDownloadGrid()

// Sidebar state
const isWorking = ref(false)
const isOpen = ref(true)
const toggleCollapsible = () => {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <v-card
    :loading="isWorking || isLayerLoading || isConverting || searchStatus === true"
    elevation="8"
    :class="{ closed: !isOpen, 'data-cabinet': true, sidebar: true, [settings.mode]: true }"
  >
    <v-card-title class="d-flex align-center pa-2">
      <div class="collapse-action" @click="toggleCollapsible">
        <v-icon
          :class="{ 'rotate-180': isOpen }"
          class="mr-1 text-white transition-transform"
          :icon="mdiChevronDown"
        >
        </v-icon>
        <span class="title text-white">
          <template v-if="settings.mode === 'inference'"> Custom Processing </template>
          <template v-else> Global Predictions </template>
        </span>
      </div>
    </v-card-title>

    <v-card-text v-show="isOpen" class="content">
      <ProcessingPanel
        v-if="settings.mode === 'inference'"
        @work-state-changed="(v) => (isWorking = v)"
      />
      <GlobalDataPanel v-else />
    </v-card-text>
  </v-card>
</template>

<style scoped>
.data-cabinet {
  left: 1rem;
  min-width: 350px;
  width: 27.5vw;
  max-width: 45vw;
}
</style>
