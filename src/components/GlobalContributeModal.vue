<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ContributeForm, ContributionType } from '../composables/useGlobalContribute'
import PersonalDetailsFields from './PersonalDetailsFields.vue'

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

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const submitted = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (open) submitted.value = false
  },
)

const contributionTypesError = computed(() =>
  submitted.value && props.contributeForm.contributionTypes.length === 0
    ? 'Please select at least one option.'
    : undefined,
)

function onSubmit() {
  submitted.value = true
  emit('submit')
}

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
    max-width="550"
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
              hide-details
            ></v-checkbox>
          </div>
          <p v-if="contributionTypesError" class="text-error text-caption mt-2 mb-0">
            {{ contributionTypesError }}
          </p>
        </div>

        <v-textarea
          :model-value="contributeForm.resources"
          @update:model-value="emit('update:form', 'resources', $event)"
          label="Do you have Field Boundaries data or a model to share?"
          hint="Share a Link or describe your resource"
          variant="outlined"
          rows="2"
          auto-grow
          class="mb-2"
          density="compact"
        ></v-textarea>

        <v-textarea
          :model-value="contributeForm.additionalInfo"
          @update:model-value="emit('update:form', 'additionalInfo', $event)"
          label="Anything else you would like us to know?"
          variant="outlined"
          rows="3"
          auto-grow
          class="mb-2"
          density="compact"
        ></v-textarea>

        <PersonalDetailsFields
          :name="contributeForm.name"
          :email="contributeForm.email"
          :organization="contributeForm.organization"
          required
          :submitted="submitted"
          density="compact"
          field-spacing="mb-2"
          @update:name="emit('update:form', 'name', $event)"
          @update:email="emit('update:form', 'email', $event)"
          @update:organization="emit('update:form', 'organization', $event)"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="teal" variant="flat" :loading="isSubmitting" @click="onSubmit">
          Submit
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
