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
      <v-tooltip
        location="top"
        :disabled="!preciseAreaValue(key, value)"
        :text="preciseAreaValue(key, value) || ''"
      >
        <template #activator="{ props: tooltipProps }">
          <div
            v-bind="tooltipProps"
            tabindex="0"
            class="text-caption text-white text-right"
            style="max-width: 120px; word-break: break-word"
          >
            {{ formattedValue(key, value) }}
          </div>
        </template>
      </v-tooltip>
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

const SQUARE_METERS_PER_HECTARE = 10000

const formatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
})

const squareMetersFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
})

function preciseAreaValue(key: string | number, value: any): string | undefined {
  if (typeof props.units === 'function' || key !== 'metrics:area' || typeof value !== 'number') {
    return undefined
  }
  return `${squareMetersFormatter.format(value)} m²`
}

function formattedValue(key: string | number, value: any): string {
  if (typeof value !== 'number') {
    return value
  }

  if (typeof props.units !== 'function' && key === 'metrics:area') {
    return `${formatter.format(value / SQUARE_METERS_PER_HECTARE)} ha`
  }

  const formatted = formatter.format(value)
  if (typeof props.units === 'function') {
    return `${formatted} ${props.units(key)}`
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
