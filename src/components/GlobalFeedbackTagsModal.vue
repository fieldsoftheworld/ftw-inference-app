<script setup lang="ts">
import type { FeedbackRating, RatingTag, TagOption } from '../composables/useGlobalFeedback'
import { RATING_TAGS } from '../composables/useGlobalFeedback'
import { computed, ref, watch } from 'vue'

interface Props {
  modelValue: boolean
  selectedLevel: FeedbackRating | null
  selectedTags: RatingTag[]
  isSubmitting: boolean
}

interface Emits {
  'update:modelValue': [value: boolean]
  'update:selectedTags': [tags: RatingTag[]]
  submit: []
  tellUsMore: []
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

const availableTags = computed<TagOption[]>(() => {
  if (!props.selectedLevel) return []
  return RATING_TAGS[props.selectedLevel]
})

const ratingLabel = computed(() => {
  if (props.selectedLevel === 3) return 'Good'
  if (props.selectedLevel === 2) return 'Acceptable'
  if (props.selectedLevel === 1) return 'Poor'
  return ''
})

const canSubmit = computed(() => props.selectedTags.length > 0)

const pendingAction = ref<'submit' | 'tellUsMore' | null>(null)

watch(
  () => props.isSubmitting,
  (val) => {
    if (!val) pendingAction.value = null
  },
)

function onTellUsMore() {
  submitted.value = true
  pendingAction.value = 'tellUsMore'
  emit('tellUsMore')
}

function onSubmit() {
  submitted.value = true
  pendingAction.value = 'submit'
  emit('submit')
}

function toggleTag(tag: RatingTag) {
  const current = [...props.selectedTags]
  const idx = current.indexOf(tag)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(tag)
  }
  emit('update:selectedTags', current)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="450"
  >
    <v-card>
      <v-card-title class="text-h5">What did you notice?</v-card-title>
      <v-card-subtitle class="text-body2 px-6 pb-2 text-wrap">
        You rated this area as <strong>{{ ratingLabel }}</strong
        >. What best describes what you observed?
      </v-card-subtitle>

      <v-card-text>
        <p v-if="submitted && !canSubmit" class="text-error text-caption mb-3 mt-0">
          Please select at least one option.
        </p>
        <v-checkbox
          v-for="tag in availableTags"
          :key="tag.value"
          :model-value="selectedTags.includes(tag.value)"
          :label="tag.label"
          color="teal"
          density="compact"
          hide-details
          @update:model-value="toggleTag(tag.value)"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn
          color="teal"
          variant="flat"
          :loading="isSubmitting && pendingAction === 'tellUsMore'"
          @click="onTellUsMore"
        >
          Tell Us More
        </v-btn>
        <v-btn
          color="teal"
          variant="flat"
          :loading="isSubmitting && pendingAction === 'submit'"
          @click="onSubmit"
        >
          Submit
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
