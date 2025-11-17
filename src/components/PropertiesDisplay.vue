<template>
  <v-list-item
    class="property-item py-1 px-0"
    density="compact"
    v-for="(value, key) in propertiesWithoutGeometry"
    :key="key"
  >
    <v-list-item-title class="text-caption text-grey-lighten-1 font-weight-medium text-capitalize">
      {{ key }}:
    </v-list-item-title>
    <template #append>
      <div
        class="text-caption text-white text-right"
        style="max-width: 120px; word-break: break-word"
      >
        {{ formattedValue(key, value, props.unit) }}
      </div>
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  properties: { [key: string]: any }
  unit?: string
}>()

const propertiesWithoutGeometry = computed(() => {
  const { geometry: _, ...propertiesWithoutGeometry } = props.properties
  return propertiesWithoutGeometry
})

function formattedValue(key: string | number, value: any, unit?: string): string {
  if (typeof value !== 'number') {
    return value
  }

  if (typeof unit === 'string') {
    return `${value.toFixed(2)} ${unit}`
  } else if (key === 'area') {
    return `${value.toFixed(2)} ha`
  } else if (key === 'perimeter') {
    return `${value.toFixed(2)} km`
  }
  return `${value.toFixed(2)}`
}
</script>

<style scoped>
.property-item {
  padding: 0.25rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.property-item:last-child {
  border-bottom: none;
}
</style>
