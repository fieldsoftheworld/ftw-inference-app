<script setup lang="ts">
import type { DetailedFeedbackForm } from '../composables/useGlobalFeedback'
import PersonalDetailsFields from './PersonalDetailsFields.vue'

interface Props {
  modelValue: boolean
  detailsForm: DetailedFeedbackForm
  canSubmit: boolean
  isSubmitting: boolean
}

interface Emits {
  'update:modelValue': [value: boolean]
  'update:form': [field: keyof DetailedFeedbackForm, value: string]
  submit: []
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="550"
  >
    <v-card>
      <v-card-title class="text-h5">Tell Us More</v-card-title>
      <v-card-subtitle class="text-body2 px-6 pb-2 text-wrap">
        We are just getting started! We know there is room to improve and we need your feedback!
      </v-card-subtitle>

      <v-card-text>
        <v-textarea
          :model-value="detailsForm.qualityFeedback"
          @update:model-value="emit('update:form', 'qualityFeedback', $event)"
          label="How can we improve field boundaries?"
          hint="Share what's good/bad and what would make them more useful to you"
          variant="outlined"
          rows="4"
          auto-grow
          required
          class="mb-3"
        ></v-textarea>

        <v-textarea
          :model-value="detailsForm.useCase"
          @update:model-value="emit('update:form', 'useCase', $event)"
          label="How would you like to use field boundaries?"
          hint="Describe your specific use case and how field boundaries could be more useful to you"
          variant="outlined"
          rows="3"
          auto-grow
          required
          class="mb-3"
        ></v-textarea>

        <PersonalDetailsFields
          :name="detailsForm.name"
          :email="detailsForm.email"
          :organization="detailsForm.organization"
          @update:name="emit('update:form', 'name', $event)"
          @update:email="emit('update:form', 'email', $event)"
          @update:organization="emit('update:form', 'organization', $event)"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn
          color="teal"
          variant="flat"
          :disabled="!canSubmit"
          :loading="isSubmitting"
          @click="emit('submit')"
        >
          Submit
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
