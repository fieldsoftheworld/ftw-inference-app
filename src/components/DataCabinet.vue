<script setup lang="ts">
import { Extent } from 'ol/extent'
import type { Map } from 'ol'
import { ref } from 'vue'
import PrecomputedExamples from './PrecomputedExamples.vue'
import RunInference from './RunInference.vue'

const props = defineProps<{
  map: Map
}>()

const runInferenceRef = ref<InstanceType<typeof RunInference> | null>(null)
const activeAccordion = ref<'precomputed' | 'inference' | null>('precomputed')

const handlePrecomputedToggle = (isOpen: boolean) => {
  activeAccordion.value = isOpen ? 'precomputed' : null
}

const handleInferenceToggle = (isOpen: boolean) => {
  activeAccordion.value = isOpen ? 'inference' : null
}

// Expose methods to parent components
defineExpose({
  handleSearchResults: (mgrsTileId: string) =>
    runInferenceRef.value?.handleSearchResults(mgrsTileId),
  setDrawnExtent: (extent: Extent) => runInferenceRef.value?.setDrawnExtent(extent),
  currentMgrsTileId: runInferenceRef.value?.currentMgrsTileId,
  handleBboxSizeWarning: (message: string) => runInferenceRef.value?.handleBboxSizeWarning(message),
  handleInferenceToggle: (isOpen: boolean) => handleInferenceToggle(isOpen),
})
</script>

<template>
  <div class="data-cabinet">
    <h2>Fields of the World: Inference App</h2>
    <PrecomputedExamples
      v-if="props.map"
      :is-open="activeAccordion === 'precomputed'"
      @update:is-open="handlePrecomputedToggle"
      :map="props.map"
    />
    <RunInference
      v-if="props.map"
      :map="props.map"
      :is-open="activeAccordion === 'inference'"
      @update:is-open="handleInferenceToggle"
      ref="runInferenceRef"
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
