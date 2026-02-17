<template lang="html">

  <v-dialog v-if="projects.length > 0" width="auto" max-height="500">
    <template v-slot:activator="{ props: activatorProps }">
      <v-btn 
        variant="outlined"
        density="comfortable"
        color="primary"
        v-bind="activatorProps"
      >
        Load
      </v-btn>
    </template>
    <template v-slot:default="{ isActive }">
      <v-card title="Load Project">
        <v-list density="compact" color="transparent" class="pa-0">
          <v-list-item
            v-for="project in projects"
            :key="project"
            @click.stop="queryProcess(project); isActive.value = false"
          >
            <v-label class="text-capitalize mb-1">{{ project }}</v-label>
          </v-list-item>
        </v-list>
      
        <v-card-actions>
          <v-spacer></v-spacer>
        
          <v-btn
            text="Close Dialog"
            @click="isActive.value = false"
          ></v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>
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
