import { ref } from 'vue'

export const processingMode = ref<'smallAreaProcessing' | 'batchProcessing' | null>(
  'smallAreaProcessing',
)

export function useProcessingMode() {
  return {
    processingMode,
  }
}
