<template>
  <v-list-item
    class="property-item py-1 px-0"
    density="compact"
    :lines="false"
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
        {{ formattedValue(key, value) }}
      </div>
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  properties: { [key: string]: any }
  units?: (key: string | number) => string
}>()

const propertiesWithoutGeometry = computed(() => {
  const { geometry: _, ...propertiesWithoutGeometry } = props.properties
  return propertiesWithoutGeometry
})

const formatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
})

function formattedValue(key: string | number, value: any): string {
  if (typeof value !== 'number') {
    return value
  }

  const formatted = formatter.format(value)
  if (typeof props.units === 'function') {
    return `${formatted} ${props.units(key)}`
  } else if (key === 'metrics:area') {
    return `${formatted} m²`
  } else if (key === 'metrics:perimeter') {
    return `${formatted} m`
  }
  return `${formatted}`
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
