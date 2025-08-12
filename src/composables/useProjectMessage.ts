import { ref } from 'vue'

const projectMessage = ref<{
  type: 'success' | 'error' | 'loading' | 'warning'
  text: string
} | null>(null)

const dismissMessage = () => {
  projectMessage.value = null
}

export function useProjectMessage() {
  return {
    projectMessage,
    dismissMessage,
  }
}
