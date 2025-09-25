<template>
  <v-list-item class="property-item py-1 px-0" density="compact">
    <v-list-item-title class="text-caption text-grey-lighten-1 font-weight-medium text-capitalize">
      {{ property.key }}:
    </v-list-item-title>
    <template #append>
      <div
        class="text-caption text-white text-right"
        style="max-width: 120px; word-break: break-word"
      >
        {{ property.formattedValue }}
      </div>
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
interface Property {
  key: string
  value: any
  formattedValue: string
}

defineProps<{
  property: Property
}>()
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
