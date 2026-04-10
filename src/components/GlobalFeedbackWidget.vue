<script setup lang="ts">
import { computed } from 'vue'
import useMap from '../composables/useMap'
import { geoJsonResults } from '../composables/useMap'
import useSettings from '../composables/useSettings'
import useGlobalFeedback from '../composables/useGlobalFeedback'

const { settings } = useSettings()
const { map } = useMap()
const hasInferenceResults = computed(() => geoJsonResults.value.length > 0)

const {
  options,
  sliderValue,
  selectedLevel,
  selectedOption,
  detailsDialogOpen,
  detailsForm,
  canProvideFeedback,
  zoomGateMessage,
  canSubmitDetailed,
  isSubmittingQuick,
  isSubmittingDetails,
  openDetailsDialog,
  closeDetailsDialog,
  submitQuickFeedback,
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
              :ticks="sliderLabels"
              show-ticks="always"
              color="teal"
              track-size="8"
              thumb-size="25"
              class="feedback-slider"
              hide-details
            ></v-slider>
          </div>

          <div v-if="selectedOption" class="feedback-description mt-3">
            {{ selectedOption.description }}
          </div>

          <div class="feedback-actions mt-3">
            <v-btn
              variant="outlined"
              color="teal"
              size="small"
              :disabled="!selectedLevel"
              @click="openDetailsDialog"
            >
              Tell Us More
            </v-btn>
            <v-btn
              variant="flat"
              color="teal"
              size="small"
              :loading="isSubmittingQuick"
              :disabled="!selectedLevel"
              @click="submitQuickFeedback"
            >
              Submit
            </v-btn>
          </div>
        </template>

        <template v-else>
          <div class="zoom-message">{{ zoomGateMessage }}</div>
        </template>
      </v-card-text>
    </v-card>

    <v-dialog v-model="detailsDialogOpen" max-width="530">
      <v-card>
        <v-card-title class="text-h5">Tell Us More</v-card-title>
        <v-card-subtitle class="text-body2 px-6 pb-2 text-wrap">
          We are just getting started! We know there is room to improve and we need your feedback!
        </v-card-subtitle>

        <v-card-text>
          <v-textarea
            v-model="detailsForm.qualityFeedback"
            label="What was good/bad? How must the field boundaries improve to be useful to you?"
            variant="outlined"
            rows="4"
            auto-grow
            required
            class="mb-3"
          ></v-textarea>

          <v-textarea
            v-model="detailsForm.useCase"
            label="How would you like to use field boundaries? Tell us about your use case."
            variant="outlined"
            rows="3"
            auto-grow
            required
            class="mb-3"
          ></v-textarea>

          <v-text-field
            v-model="detailsForm.name"
            label="Name"
            variant="outlined"
            class="mb-3"
          ></v-text-field>

          <v-text-field
            v-model="detailsForm.email"
            type="email"
            label="Email"
            variant="outlined"
            class="mb-3"
          ></v-text-field>

          <v-text-field
            v-model="detailsForm.organization"
            label="Organization"
            variant="outlined"
          ></v-text-field>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeDetailsDialog">Cancel</v-btn>
          <v-btn
            color="teal"
            variant="flat"
            :disabled="!canSubmitDetailed"
            :loading="isSubmittingDetails"
            @click="submitDetailedFeedback"
          >
            Submit
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.feedback-wrapper {
  position: fixed;
  left: 50%;
  bottom: 1rem;
  transform: translateX(-50%);
  z-index: 2000;
  width: min(90vw, 350px);
}

.feedback-card {
  background-color: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(0, 136, 136, 0.65);
  backdrop-filter: blur(8px);
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
  padding: 0.6rem 0.4rem;
}

.feedback-slider {
  margin-top: 0.3rem;
  margin-bottom: 0.3rem;
}

.feedback-slider :deep(.v-slider__tick-label) {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.feedback-description {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
  background-color: rgba(0, 136, 136, 0.15);
  padding: 0.5rem;
  border-radius: 4px;
  line-height: 1.3;
  margin-top: 0.6rem !important;
  text-align: center;
}

.feedback-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.35rem;
  margin-top: 0.6rem !important;
}

.zoom-message {
  font-size: 0.8rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.95);
}

@media (max-width: 768px) {
  .feedback-actions {
    justify-content: space-between;
  }
}
</style>
