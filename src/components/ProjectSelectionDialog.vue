<template lang="html">
  <v-dialog
    v-if="projects.length > 0"
    v-model="isActive"
    width="auto"
    max-height="70%"
    max-width="50%"
    min-width="300px"
  >
    <template #activator="{ props: activatorProps }">
      <v-btn
        variant="outlined"
        color="primary"
        size="small"
        class="pa-0"
        title="Show previous results from batch processing"
        v-bind="activatorProps"
      >
        Load
      </v-btn>
    </template>
    <template #default>
      <v-card title="Load Project">
        <v-list density="compact" color="transparent" class="pa-0">
          <v-list-item
            v-for="project in sortedProjects"
            :key="project"
            @click.prevent="queryProcess(project)"
          >
            <v-label class="text-capitalize mb-1">{{ project }}</v-label>
          </v-list-item>
        </v-list>

        <v-card-actions>
          <v-spacer></v-spacer>

          <v-btn text="Close" @click="closeDialog"></v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import useProcessing from '../composables/useProcessing'
import useMap from '../composables/useMap'

const { projects, loadProject } = useProcessing()
const { displayGeoJSON, fitMapToBbox } = useMap()

const isActive = ref(false)

const sortedProjects = computed(() => {
  return projects.value.slice().reverse()
})

const closeDialog = () => {
  isActive.value = false
}

const queryProcess = async (id: string) => {
  closeDialog()
  const polygons = await loadProject(id)
  displayGeoJSON(polygons)
  fitMapToBbox(polygons.bbox)
}
</script>

<style lang="css" scoped></style>
