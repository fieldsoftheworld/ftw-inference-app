import { useNotifier as useVuetifyNotifier } from 'vuetify-notifier'

export interface NotifierMessage {
  type: 'warning' | 'error' | 'info' | 'success'
  text: string
  timeout?: number
}

export default function useNotifier() {
  const notifier = useVuetifyNotifier()

  const showNotifier = (notification: NotifierMessage) => {
    let { type, text, timeout = 10 } = notification
    if (timeout > 0) {
      timeout *= 1000 // convert to milliseconds
    }
    notifier.toast({
      type,
      text,
      color: type,
    })
  }

  // todo: reimplement timeouts in toasts
  const showWarning = (text: string, timeout: number = 10) => {
    showNotifier({ type: 'warning', text, timeout })
  }

  const showError = (text: string, timeout: number = 15) => {
    showNotifier({ type: 'error', text, timeout })
  }

  const showCritical = (text: string, timeout: number = -1) => {
    showNotifier({ type: 'error', text, timeout })
  }

  const showSuccess = (text: string, timeout: number = 5) => {
    showNotifier({ type: 'success', text, timeout })
  }

  const showInfo = (text: string, timeout: number = 10) => {
    showNotifier({ type: 'info', text, timeout })
  }

  return {
    showNotifier,
    showWarning,
    showError,
    showCritical,
    showSuccess,
    showInfo,
  }
}
