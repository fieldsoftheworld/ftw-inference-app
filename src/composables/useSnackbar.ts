import { ref } from 'vue'

interface SnackbarMessage {
  type: 'warning' | 'error' | 'info' | 'success'
  text: string
  color?: string
  timeout?: number
}

const messages = ref<SnackbarMessage[]>([])

export const showSnackbar = (message: SnackbarMessage) => {
  if (message.timeout && message.timeout > 0) {
    message.timeout *= 1000 // convert to milliseconds
  }
  messages.value.push(message)
}

export const showWarning = (text: string, timeout: number = 10) => {
  showSnackbar({ type: 'warning', color: 'warning', text, timeout })
}

export const showError = (text: string, timeout: number = 30) => {
  showSnackbar({ type: 'error', color: 'error', text, timeout })
}

export const showCritical = (text: string, timeout: number = -1) => {
  showSnackbar({ type: 'error', color: 'error', text, timeout })
}

export const showSuccess = (text: string, timeout: number = 5) => {
  showSnackbar({ type: 'success', color: 'success', text, timeout })
}

export const showInfo = (text: string, timeout: number = 10) => {
  showSnackbar({ type: 'info', color: 'info', text, timeout })
}

export function useSnackbar() {
  return {
    messages,
    showSnackbar,
    showWarning,
    showError,
    showCritical,
    showSuccess,
    showInfo,
  }
}
