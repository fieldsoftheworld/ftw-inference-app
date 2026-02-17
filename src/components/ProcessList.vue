<template lang="html">
  <v-expansion-panel-text>
    <v-list density="compact" color="transparent" class="pa-0">
      <v-list-item
        v-for="project in projects"
        class="group"
        :key="project"
        @click.stop="queryProcess(project)"
      >
        <v-label class="text-capitalize mb-1">{{ project }}</v-label>
      </v-list-item>
    </v-list>
  </v-expansion-panel-text>
</template>

<script setup lang="ts">
import useProcessing from '../composables/useProcessing'
import useMap from '../composables/useMap'

const { projects, loadProject } = useProcessing()
const { displayGeoJSON, fitMapToBbox } = useMap()

const queryProcess = async (id: string) => {
  const polygons = await loadProject(id)
  displayGeoJSON(polygons)
  fitMapToBbox(polygons.bbox)
}
</script>

<style lang="css" scoped></style>
