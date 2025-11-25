import { useNotifier as useVuetifyNotifier } from 'vuetify-notifier'

export interface NotifierMessage {
  type: 'warning' | 'error' | 'info' | 'success'
  text: string
}

export const TIMEOUT = 20000

const lastMessages: Record<string, string> = {}

export default function useNotifier() {
  const notifier = useVuetifyNotifier()

  const showNotifier = (notification: NotifierMessage) => {
    let { type, text } = notification //eslint-disable-line prefer-const
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
    // Reset last message after timeout to avoid swallowing
    // new messages (with the same text) forever
    window.setTimeout(() => {
      if (lastMessages[type] === text) {
        lastMessages[type] = ''
      }
    }, TIMEOUT)
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
