<script setup lang="ts">
import { computed } from 'vue'
import useMap from '../composables/useMap'
import { geoJsonResults } from '../composables/useMap'
import useSettings from '../composables/useSettings'
import GlobalFeedbackDetailsModal from './GlobalFeedbackDetailsModal.vue'
import GlobalFeedbackTagsModal from './GlobalFeedbackTagsModal.vue'
import useGlobalFeedback from '../composables/useGlobalFeedback'

const { settings } = useSettings()
const { map } = useMap()
const hasInferenceResults = computed(() => geoJsonResults.value.length > 0)

const {
  options,
  sliderValue,
  selectedLevel,
  detailsDialogOpen,
  detailsForm,
  tagsDialogOpen,
  selectedTags,
  canProvideFeedback,
  zoomGateMessage,
  canSubmitQuick,
  canSubmitDetailed,
  isSubmittingQuick,
  isSubmittingDetails,
  openDetailsDialogFromTags,
  submitQuickFeedback,
  submitRatingWithTags,
  submitDetailedFeedback,
} = useGlobalFeedback(map)

const sliderLabels = computed(() => {
  return Object.fromEntries(options.map((opt, i) => [i, opt.title]))
})
</script>

<template>
  <div v-if="settings.mode === 'global' && !hasInferenceResults" class="feedback-wrapper">
    <v-card class="feedback-card" elevation="10">
      <v-card-text class="pa-3">
        <h4 class="feedback-title" v-if="canProvideFeedback">Rate the Fields in this View</h4>

        <template v-if="canProvideFeedback">
          <div class="slider-container">
            <v-slider
              v-model="sliderValue"
              :min="0"
              :max="2"
              :step="1"
              thumb-label
              :ticks="sliderLabels"
              show-ticks="always"
              color="teal"
              track-size="8"
              tick-size="4"
              thumb-size="25"
              class="feedback-slider"
              hide-details
            >
              <template #thumb-label="{ modelValue }">
                <div class="thumb-label-description">{{ options[modelValue]?.description }}</div>
              </template>
            </v-slider>
          </div>

          <div class="feedback-actions mt-3">
            <v-btn
              variant="flat"
              :color="canSubmitQuick ? 'teal' : undefined"
              size="small"
              :loading="isSubmittingQuick"
              :disabled="!canSubmitQuick"
              @click="submitQuickFeedback"
            >
              Continue
            </v-btn>
          </div>
        </template>

        <template v-else>
          <div class="zoom-message">{{ zoomGateMessage }}</div>
        </template>
      </v-card-text>
    </v-card>

    <GlobalFeedbackDetailsModal
      v-model="detailsDialogOpen"
      :details-form="detailsForm"
      :can-submit="canSubmitDetailed"
      :is-submitting="isSubmittingDetails"
      @update:form="(field, value) => (detailsForm[field] = value)"
      @submit="submitDetailedFeedback"
    />

    <GlobalFeedbackTagsModal
      v-model="tagsDialogOpen"
      :selected-level="selectedLevel"
      :selected-tags="selectedTags"
      :is-submitting="isSubmittingQuick"
      @update:selected-tags="selectedTags = $event"
      @submit="submitRatingWithTags"
      @tell-us-more="openDetailsDialogFromTags"
    />
  </div>
</template>

<style scoped>
.feedback-wrapper {
  position: absolute;
  left: 50%;
  bottom: 1rem;
  transform: translateX(-50%);
  z-index: 1001;
  width: min(90vw, 300px);
}

.feedback-card {
  background-color: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(0, 136, 136, 0.65);
  backdrop-filter: blur(8px);
  overflow: visible;
}

.feedback-card :deep(.v-card-text) {
  padding: 0.75rem;
}

.feedback-title {
  margin: 0;
  color: rgba(255, 255, 255, 0.95);
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
}

.slider-container {
  margin-bottom: 0.6rem;
  padding: 1.2rem 0.4rem 0.6rem 0.4rem;
}

.feedback-slider {
  margin-bottom: 0.3rem;
}

.feedback-slider :deep(.v-slider__tick-label) {
  color: rgba(255, 255, 255, 0.7);
}

.feedback-slider :deep(.v-slider-thumb__label) {
  background-color: rgba(0, 136, 136, 1);
  min-width: 220px;
  min-height: 50px;
  padding: 10px;
}

.thumb-label-description {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.3;
  text-align: center;
}

.feedback-actions {
  display: flex;
  justify-content: center;
  gap: 0.35rem;
  margin-top: 1.2rem;
}

.zoom-message {
  font-size: 0.8rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.95);
}
</style>
