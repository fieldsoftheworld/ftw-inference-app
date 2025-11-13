import { ref, computed } from 'vue'
import useNotifier from './useNotifier'
import useMap, { type AreaValues } from './useMap'

const processingMode = ref<'smallAreaProcessing' | 'batchProcessing' | null>('smallAreaProcessing')

export default function useProcessingMode() {
  const { maxArea } = useMap()
  const { showWarning, showError } = useNotifier()

  function updateProcessingMode(area: number, areaValues: AreaValues) {
    if (area < areaValues.min_area_km2) {
      showWarning(
        `The selected area is below the minimum threshold of ${areaValues.min_area_km2} km². Please select a larger area. Using last valid state.`,
      )
    }
    if (area > maxArea) {
      showError(
        `The selected area exceeds the maximum limit of ${maxArea} km². Please select a smaller area. Using last valid state.`,
      )
    }
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
