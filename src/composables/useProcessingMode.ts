import { ref, computed } from 'vue'

const processingMode = ref<'smallAreaProcessing' | 'batchProcessing' | null>('smallAreaProcessing')

export default function useProcessingMode() {
  function updateProcessingMode(area: number, areaValues: AreaValues) {
    if (area > areaValues.max_area_km2) {
      processingMode.value = 'batchProcessing'
    } else {
      processingMode.value = 'smallAreaProcessing'
    }
  }

  const isBatchProcessing = computed(() => {
    return processingMode.value === 'batchProcessing'
  })

  return {
    processingMode,
    updateProcessingMode,
    isBatchProcessing,
  }
}
