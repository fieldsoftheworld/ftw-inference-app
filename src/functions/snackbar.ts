interface SnackbarMessage {
  type: 'warning' | 'error' | 'info' | 'success'
  text: string
  duration?: number
}

export const showSnackbar = (message: SnackbarMessage) => {
  if (typeof window !== 'undefined' && (window as any).showSnackbar) {
    ;(window as any).showSnackbar(message)
  } else {
    // Fallback to console if snackbar is not available
    console.warn('Snackbar not available:', message.text)
  }
}

export const showWarning = (text: string, duration: number = 5000) => {
  showSnackbar({ type: 'warning', text, duration })
}

export const showError = (text: string, duration: number = 5000) => {
  showSnackbar({ type: 'error', text, duration })
}

export const showSuccess = (text: string, duration: number = 3000) => {
  showSnackbar({ type: 'success', text, duration })
}

export const showInfo = (text: string, duration: number = 4000) => {
  showSnackbar({ type: 'info', text, duration })
}
