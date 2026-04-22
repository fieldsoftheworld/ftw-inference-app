<script setup lang="ts">
import { computed } from 'vue'
import { isValidEmail } from '../functions/feedback-utils'

interface Props {
  name: string
  email: string
  organization: string
  required?: boolean
  submitted?: boolean
  density?: 'default' | 'comfortable' | 'compact'
  fieldSpacing?: string
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  submitted: false,
  density: 'default',
  fieldSpacing: 'mb-3',
})

interface Emits {
  'update:name': [value: string]
  'update:email': [value: string]
  'update:organization': [value: string]
}

const emit = defineEmits<Emits>()

const nameError = computed(() => {
  if (props.required && props.submitted && !props.name.trim()) {
    return 'This field is required.'
  }
  return undefined
})

const emailError = computed(() => {
  if (props.required && props.submitted && !props.email.trim()) {
    return 'This field is required.'
  }
  if (props.submitted && props.email && !isValidEmail(props.email)) {
    return 'Please enter a valid email address.'
  }
  return undefined
})
</script>

<template>
  <v-text-field
    :model-value="name"
    @update:model-value="emit('update:name', ($event ?? '').trim())"
    :label="required ? 'Name *' : 'Name'"
    variant="outlined"
    :density="density"
    :class="fieldSpacing"
    :error-messages="nameError"
  ></v-text-field>

  <v-text-field
    :model-value="email"
    @update:model-value="emit('update:email', ($event ?? '').trim())"
    type="email"
    :label="required ? 'Email *' : 'Email'"
    variant="outlined"
    :density="density"
    :class="fieldSpacing"
    :error-messages="emailError"
  ></v-text-field>

  <v-text-field
    :model-value="organization"
    @update:model-value="emit('update:organization', ($event ?? '').trim())"
    label="Organization"
    variant="outlined"
    :density="density"
  ></v-text-field>
</template>
