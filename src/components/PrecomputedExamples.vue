<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
}>()

const toggleAccordion = () => {
  emit('update:isOpen', !props.isOpen)
}
</script>

<template>
  <div>
    <div class="accordion-header" @click="toggleAccordion">
      <h3>Precomputed Examples</h3>
      <span class="accordion-icon" :class="{ open: props.isOpen }">▼</span>
    </div>

    <transition name="accordion">
      <div v-show="props.isOpen" class="results">
        <div class="example-field">
          <div class="result-header">
            <h3>Precomputed Examples</h3>
          </div>
          <div class="result-details">
            <!-- Add your precomputed examples content here -->
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: rgba(0, 136, 136, 0.2);
  border: 1px solid rgba(0, 136, 136, 0.8);
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 0.125rem;
}

.accordion-header h3 {
  margin: 0;
  font-size: 1rem;
  color: white;
}

.accordion-icon {
  color: white;
  transition: transform 0.3s ease;
  font-size: 0.75rem;
}

.accordion-icon.open {
  transform: rotate(180deg);
}

.results {
  flex: 5;
  overflow-y: auto;
  transition: opacity 0.3s ease;
}

.example-field {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.result-header h3 {
  margin: 0;
  font-size: 1rem;
  color: white;
  word-break: break-word;
}

.result-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
