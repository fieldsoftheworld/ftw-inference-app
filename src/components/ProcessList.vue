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
import { generateJWT } from '../functions/generate-jwt'
import useProcessing from '../composables/useProcessing'
import useMap from '../composables/useMap'

const { projects } = useProcessing()
const { displayGeoJSON } = useMap()

const queryProcess = async (id) => {
  const token = generateJWT()
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}projects/${id}/inference`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }).then( res  => res.json() )
  const blob = await fetch(res.polygons)
  const data = await blob.text()
  const polygons = JSON.parse(data)
  displayGeoJSON(polygons) //TODO: fit map to bbox
}

</script>

<style lang="css" scoped>

</style>