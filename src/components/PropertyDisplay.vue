<template>
  <div class="property-item">
    <span class="property-key">{{ property.key }}:</span>
    <span class="property-value">{{ property.formattedValue }}</span>
  </div>
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.property-item:last-child {
  border-bottom: none;
}

.property-key {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  text-transform: capitalize;
}

.property-value {
  color: white;
  text-align: right;
  max-width: 120px;
  word-break: break-word;
}
</style>
