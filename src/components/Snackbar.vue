<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface SnackbarMessage {
  id: string
  type: 'warning' | 'error' | 'info' | 'success'
  text: string
  duration?: number
}

const messages = ref<SnackbarMessage[]>([])
const nextId = ref(1)

const showMessage = (message: Omit<SnackbarMessage, 'id'>) => {
  const id = `snackbar-${nextId.value++}`
  const newMessage: SnackbarMessage = {
    id,
    type: message.type,
    text: message.text,
    duration: message.duration ?? 5000, // Default 5 seconds
  }

  messages.value.push(newMessage)

  // Auto-remove after duration
  if (newMessage.duration && newMessage.duration > 0) {
    setTimeout(() => {
      removeMessage(id)
    }, newMessage.duration)
  }
}

const removeMessage = (id: string) => {
  const index = messages.value.findIndex((msg) => msg.id === id)
  if (index > -1) {
    messages.value.splice(index, 1)
  }
}

// Expose the showMessage function globally
const exposeSnackbar = () => {
  if (typeof window !== 'undefined') {
    ;(window as any).showSnackbar = showMessage
  }
}

onMounted(() => {
  exposeSnackbar()
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    delete (window as any).showSnackbar
  }
})

defineExpose({
  showMessage,
  removeMessage,
})
</script>

<template>
  <div class="snackbar-container">
    <TransitionGroup name="snackbar" tag="div" class="snackbar-list">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['snackbar', `snackbar-${message.type}`]"
      >
        <div class="snackbar-content">
          <span class="snackbar-icon">
            <span v-if="message.type === 'warning'">⚠️</span>
            <span v-else-if="message.type === 'error'">❌</span>
            <span v-else-if="message.type === 'success'">✅</span>
            <span v-else-if="message.type === 'info'">ℹ️</span>
          </span>
          <span class="snackbar-text">{{ message.text }}</span>
        </div>
        <button class="snackbar-close" @click="removeMessage(message.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.snackbar-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  pointer-events: none;
}

.snackbar-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: auto;
}

.snackbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 285px;
  max-width: 475px;
  padding: 11px 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 16px;
  line-height: 1.4;
}

.snackbar-warning {
  background-color: rgba(255, 193, 7, 0.95);
  border-color: rgba(255, 193, 7, 0.3);
  color: white;
}

.snackbar-error {
  background-color: rgba(220, 53, 69, 0.95);
  border-color: rgba(220, 53, 69, 0.3);
  color: white;
}

.snackbar-success {
  background-color: rgba(40, 167, 69, 0.95);
  border-color: rgba(40, 167, 69, 0.3);
  color: white;
}

.snackbar-info {
  background-color: rgba(23, 162, 184, 0.95);
  border-color: rgba(23, 162, 184, 0.3);
  color: white;
}

.snackbar-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.snackbar-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.snackbar-text {
  flex: 1;
  word-wrap: break-word;
}

.snackbar-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 17px;
  cursor: pointer;
  padding: 0;
  margin-left: 8px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
  width: 19px;
  height: 19px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.snackbar-close:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}

/* Transition animations */
.snackbar-enter-active,
.snackbar-leave-active {
  transition: all 0.3s ease;
}

.snackbar-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.snackbar-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.snackbar-move {
  transition: transform 0.3s ease;
}
</style>
