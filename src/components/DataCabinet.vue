<script setup lang="ts">
import { mdiChevronDown } from '@mdi/js'
import { ref, defineEmits } from 'vue'
import useAreaOfInterest from '../composables/useAreaOfInterest'
import useSearch from '../composables/useSearch'
import ProcessingPanel from './ProcessingPanel.vue'

const emit = defineEmits<{
  (e: 'updateGeoJSONResults', results: any[]): void
}>()

const { searchStatus } = useSearch()
const { currentMgrsTileId } = useAreaOfInterest()

// Sidebar state
const isProcessing = ref(false)
const isOpen = ref(true)
const toggleCollapsible = () => {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <v-card
    :loading="isProcessing || searchStatus === true"
    elevation="8"
    :class="{ closed: !isOpen, 'data-cabinet': true, sidebar: true }"
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
          Processing
          <v-badge
            v-if="currentMgrsTileId"
            inline
            :content="currentMgrsTileId"
            title="The selected tile identifier"
          ></v-badge>
        </span>
      </div>
    </v-card-title>

    <div v-show="isOpen" class="content">
      <ProcessingPanel
        v-if="currentMgrsTileId"
        @processing-changed="(v) => (isProcessing = v)"
        @updateGeoJSONResults="
          (results) => {
            emit('updateGeoJSONResults', results)
          }
        "
      />
      <p v-else class="pa-4 text-center">Select a grid cell to search for Sentinel-2 images.</p>
    </div>
  </v-card>
</template>

<style scoped>
.data-cabinet {
  left: 1rem;
  min-width: 300px;
  width: 30vw;
  max-width: 45vw;
}
.data-cabinet.sidebar .content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
