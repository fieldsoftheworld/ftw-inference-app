<script setup lang="ts">
import type { ContributeForm, ContributionType } from '../composables/useGlobalContribute'

interface Props {
  modelValue: boolean
  contributeForm: ContributeForm
  contributionOptions: Array<{ value: ContributionType; label: string; description: string }>
  canSubmit: boolean
  isSubmitting: boolean
}

interface Emits {
  'update:modelValue': [value: boolean]
  'update:form': [field: keyof ContributeForm, value: any]
  submit: []
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const toggleContributionType = (type: ContributionType, form: ContributeForm) => {
  const index = form.contributionTypes.indexOf(type)
  const newTypes = [...form.contributionTypes]
  if (index >= 0) {
    newTypes.splice(index, 1)
  } else {
    newTypes.push(type)
  }
  emit('update:form', 'contributionTypes', newTypes)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="530"
  >
    <v-card>
      <v-card-title class="text-h5">Become a Contributor</v-card-title>
      <v-card-subtitle class="text-body2 px-6 pb-2 text-wrap">
        To carry FTW forward will require the collective talent and resources of our community. We
        welcome your contributions and partnership!
      </v-card-subtitle>

      <v-card-text>
        <div class="mb-3">
          <p class="text-xs font-weight-bold mb-2">How would you like to contribute? *</p>
          <div class="d-flex flex-column">
            <v-checkbox
              v-for="option in contributionOptions"
              :key="option.value"
              :model-value="contributeForm.contributionTypes.includes(option.value)"
              :label="option.label"
              @update:model-value="toggleContributionType(option.value, contributeForm)"
              class="pa-0 ma-0"
              density="compact"
            ></v-checkbox>
          </div>
        </div>

        <v-text-field
          :model-value="contributeForm.resourceLink"
          @update:model-value="emit('update:form', 'resourceLink', $event)"
          label="Do you have Field Boundaries data or a model that we should know about? Share a link"
          hint="Expected: URL"
          variant="outlined"
          class="mb-2"
          density="compact"
        ></v-text-field>

        <v-textarea
          :model-value="contributeForm.additionalInfo"
          @update:model-value="emit('update:form', 'additionalInfo', $event)"
          label="Anything else you would like us to know?"
          variant="outlined"
          rows="2"
          auto-grow
          class="mb-2"
          density="compact"
        ></v-textarea>

        <v-text-field
          :model-value="contributeForm.name"
          @update:model-value="emit('update:form', 'name', $event)"
          label="Name *"
          variant="outlined"
          class="mb-2"
          density="compact"
          required
        ></v-text-field>

        <v-text-field
          :model-value="contributeForm.email"
          @update:model-value="emit('update:form', 'email', $event)"
          label="Email *"
          type="email"
          variant="outlined"
          class="mb-2"
          density="compact"
          required
        ></v-text-field>

        <v-text-field
          :model-value="contributeForm.organization"
          @update:model-value="emit('update:form', 'organization', $event)"
          label="Organization"
          variant="outlined"
          density="compact"
        ></v-text-field>
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
