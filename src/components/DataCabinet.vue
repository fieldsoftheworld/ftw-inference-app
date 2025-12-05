<script setup lang="ts">
import { mdiChevronDown } from '@mdi/js'
import { ref } from 'vue'
import useSearch from '../composables/useSearch'
import useSettings from '../composables/useSettings'
import ProcessingPanel from './ProcessingPanel.vue'

const { searchStatus } = useSearch()
const { modelTitle, settings } = useSettings()

// Sidebar state
const isWorking = ref(false)
const isOpen = ref(true)
const toggleCollapsible = () => {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <v-card
    :loading="isWorking || searchStatus === true"
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
            v-if="modelTitle && !settings.expertMode"
            inline
            :content="`Model: ${modelTitle}`"
          ></v-badge>
        </span>
      </div>
    </v-card-title>

    <v-card-text v-show="isOpen" class="content">
      <ProcessingPanel @work-state-changed="(v) => (isWorking = v)" />
    </v-card-text>
  </v-card>
</template>

<style scoped>
.data-cabinet {
  left: 1rem;
  min-width: 300px;
  width: 30vw;
  max-width: 45vw;
}
</style>
