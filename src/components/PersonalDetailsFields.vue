<script setup lang="ts">
import { computed } from 'vue'
import { isValidEmail } from '../functions/feedback-utils'

interface Props {
  name: string
  email: string
  organization: string
  required?: boolean
  density?: 'default' | 'comfortable' | 'compact'
  fieldSpacing?: string
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  density: 'default',
  fieldSpacing: 'mb-3',
})

interface Emits {
  'update:name': [value: string]
  'update:email': [value: string]
  'update:organization': [value: string]
}

const emit = defineEmits<Emits>()

const emailError = computed(() =>
  props.email && !isValidEmail(props.email) ? 'Please enter a valid email address.' : undefined,
)
</script>

<template>
  <v-text-field
    :model-value="name"
    @update:model-value="emit('update:name', ($event ?? '').trim())"
    :label="required ? 'Name *' : 'Name'"
    variant="outlined"
    :density="density"
    :class="fieldSpacing"
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
