<script setup lang="ts">
import useSettings from '../composables/useSettings'

const { settings } = useSettings()
</script>

<template>
  <div class="settings">
    <v-alert density="compact" type="info" color="gray" class="mb-2">
      The <strong>global predictions</strong> provide global-scale estimates of agricultural fields
      for 2024-2025. They were computed using the model <strong>FTW v3: CC-BY, B7</strong>.
    </v-alert>

    <v-row class="d-flex justify-center w-100 mx-auto">
      <v-col>
        <h3 class="group">Layers</h3>
        <v-switch v-model="settings.fieldBoundaries" density="compact" hide-details class>
          <template #label> Field Boundaries </template>
        </v-switch>
        <v-switch v-model="settings.confidence" density="compact" hide-details class>
          <template #label> Confidence scores </template>
        </v-switch>

        <h3 class="group">
          Confidence Threshold: {{ (settings.confidenceThreshold * 100).toFixed(0) }}%
        </h3>
        <v-slider
          v-model.number="settings.confidenceThreshold"
          :min="0"
          :max="1"
          :step="0.01"
          color="teal"
          track-color="grey-darken-2"
          thumb-color="teal"
          hide-details
        />
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.group {
  margin: 0.5rem -0.5rem;
  font-weight: 500;
  font-size: 1.1rem;
}
</style>
