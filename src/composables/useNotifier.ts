import { useNotifier as useVuetifyNotifier } from 'vuetify-notifier'

export interface NotifierMessage {
  type: 'warning' | 'error' | 'info' | 'success'
  text: string
  timeout?: number
}

const lastMessages: Record<string, string> = {}

export default function useNotifier() {
  const notifier = useVuetifyNotifier()

  const showNotifier = (notification: NotifierMessage) => {
    let { type, text } = notification
    if (lastMessages[type] === text) {
      return
    }
    // Remove common Python error prefix if returned by the server
    text = text.replace('ValueError: ', '')
    notifier.toast({
      type,
      text,
      color: type,
    })
    lastMessages[type] = text
  }

  // todo: reimplement timeouts in toasts
  const showWarning = (text: string) => {
    showNotifier({ type: 'warning', text })
  }

  const showError = (text: string) => {
    showNotifier({ type: 'error', text })
  }

  const showSuccess = (text: string) => {
    showNotifier({ type: 'success', text })
  }

  const showInfo = (text: string) => {
    showNotifier({ type: 'info', text })
  }

  return {
    showNotifier,
    showWarning,
    showError,
    showSuccess,
    showInfo,
  }
}
