import { ref, computed } from 'vue'
import { useSnackbar } from './useSnackbar'
import { useMap } from './useMap'

const { showWarning, showError } = useSnackbar()
const { maxArea } = useMap()

export const processingMode = ref<'smallAreaProcessing' | 'batchProcessing' | null>(
  'smallAreaProcessing',
)

export function updateProcessingMode(area: number, areaValues) {
  if (!areaValues.value) {
    return
  }
  if (area < areaValues.value.min_area_km2) {
    showWarning(
      `The selected area is below the minimum threshold of ${areaValues.value.min_area_km2} km². Please select a larger area. Using last valid state.`,
    )
  }
  if (area > maxArea) {
    showError(
      `The selected area exceeds the maximum limit of ${areaValues.value.max_area_km2} km². Please select a smaller area. Using last valid state.`,
    )
  }
  if (area > areaValues.value.max_area_km2) {
    processingMode.value = 'batchProcessing'
  } else {
    processingMode.value = 'smallAreaProcessing'
  }
}

const isBatchProcessing = computed(() => {
  return processingMode.value === 'batchProcessing'
})

export function useProcessingMode() {
  return {
    processingMode,
    updateProcessingMode,
    isBatchProcessing,
  }
}
