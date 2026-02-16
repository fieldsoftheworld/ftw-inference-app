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

const { projects } = useProcessing()

const queryProcess = (id) => {
  const token = generateJWT()
  fetch(`${import.meta.env.VITE_API_BASE_URL}projects/${id}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  })
}

</script>

<style lang="css" scoped>

</style>