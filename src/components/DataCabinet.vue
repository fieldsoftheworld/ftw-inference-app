<script setup lang="ts">
import type { Extent } from 'ol/extent'
import type { Map } from 'ol'
import { ref } from 'vue'
import SmallAreaProcessing from './SmallAreaProcessing.vue'
import BatchProcessing from './BatchProcessing.vue'

const props = defineProps<{
  map: Map
}>()

const batchProcessingRef = ref<InstanceType<typeof BatchProcessing> | null>(null)
const activeAccordion = ref<'smallAreaProcessing' | 'batchProcessing' | null>('smallAreaProcessing')

const handleSmallAreaProcessingToggle = (isOpen: boolean) => {
  activeAccordion.value = isOpen ? 'smallAreaProcessing' : null
}

const handleBatchProcessingToggle = (isOpen: boolean) => {
  activeAccordion.value = isOpen ? 'batchProcessing' : null
}

// Expose methods to parent components
defineExpose({
  handleSearchResults: (mgrsTileId: string) =>
    batchProcessingRef.value?.handleSearchResults(mgrsTileId),
  setDrawnExtent: (extent: Extent) => batchProcessingRef.value?.setDrawnExtent(extent),
  currentMgrsTileId: batchProcessingRef.value?.currentMgrsTileId,
  handleBboxSizeWarning: (message: string) =>
    batchProcessingRef.value?.handleBboxSizeWarning(message),
  handleBatchProcessingToggle: (isOpen: boolean) => handleBatchProcessingToggle(isOpen),
})
</script>

<template>
  <div class="data-cabinet">
    <h2>Fields of the World: Inference App</h2>
    <SmallAreaProcessing
      v-if="props.map"
      :is-open="activeAccordion === 'smallAreaProcessing'"
      @update:is-open="handleSmallAreaProcessingToggle"
      :map="props.map"
    />
    <BatchProcessing
      v-if="props.map"
      :map="props.map"
      :is-open="activeAccordion === 'batchProcessing'"
      @update:is-open="handleBatchProcessingToggle"
      ref="batchProcessingRef"
    />
  </div>
</template>

<style scoped>
.data-cabinet {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 300px;
  height: 90vh;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 1rem;
  border-radius: 4px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  color: white;
}
</style>
