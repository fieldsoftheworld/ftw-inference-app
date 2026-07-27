import { computed, onBeforeUnmount, ref, type ShallowRef, watch } from 'vue'
import type Map from 'ol/Map'
import type View from 'ol/View'
import { toLonLat } from 'ol/proj'
import { unByKey } from 'ol/Observable'
import type { EventsKey } from 'ol/events'
import useNotifier from './useNotifier'
import useSettings, {
  GLOBAL_DATA_MAP_COMPLETE_ZOOM_LEVEL,
  GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL,
} from './useSettings'
import {
  isValidEmail,
  loadPersonalDetails,
  postToEndpoint,
  savePersonalDetails,
} from '../functions/feedback-utils'

export type FeedbackRating = 1 | 2 | 3

export type RatingTag =
  | 'clean_boundaries'
  | 'good_shapes'
  | 'better_than_expected'
  | 'over_merged'
  | 'fragmented'
  | 'missing_fields'
  | 'false_positives'
  | 'jagged_boundaries'
  | 'tiling_artifacts'

export interface TagOption {
  value: RatingTag
  label: string
}

interface FeedbackOption {
  rating: FeedbackRating
  title: string
  description: string
}

export interface DetailedFeedbackForm {
  qualityFeedback: string
  useCase: string
  name: string
  email: string
  organization: string
}

const GOOD_TAGS: TagOption[] = [
  { value: 'clean_boundaries', label: 'Boundary lines are clean and precise' },
  { value: 'good_shapes', label: 'Field shapes are accurate' },
  { value: 'better_than_expected', label: 'Quality exceeded expectations' },
]

const POOR_ACCEPTABLE_TAGS: TagOption[] = [
  { value: 'over_merged', label: 'Fields are incorrectly merged together' },
  { value: 'fragmented', label: 'Fields are incorrectly split into pieces' },
  { value: 'missing_fields', label: 'Real fields are absent from the output' },
  { value: 'false_positives', label: 'Boundaries appear in areas with no fields' },
  { value: 'jagged_boundaries', label: 'Boundary lines are noisy or jagged' },
  { value: 'tiling_artifacts', label: 'Visible seams or discontinuities from tiling' },
]

export const RATING_TAGS: Record<FeedbackRating, TagOption[]> = {
  1: POOR_ACCEPTABLE_TAGS,
  2: POOR_ACCEPTABLE_TAGS,
  3: GOOD_TAGS,
}

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  {
    rating: 1,
    title: 'Poor',
    description: "These fields won't work for me",
  },
  {
    rating: 2,
    title: 'Acceptable',
    description: 'I can use these fields, but they need some work',
  },
  {
    rating: 3,
    title: 'Good',
    description: 'These fields work for my use case',
  },
]

function calculateViewportBbox(view: View): [number, number, number, number] | null {
  const extent = view.calculateExtent()
  if (!extent) return null

  // Convert from map projection (EPSG:3857) to WGS84 (EPSG:4326)
  const projection = view.getProjection()
  const [minX, minY, maxX, maxY] = extent

  const [minLng, minLat] = toLonLat([minX, minY], projection)
  const [maxLng, maxLat] = toLonLat([maxX, maxY], projection)

  return [minLng, minLat, maxLng, maxLat]
}

function getViewState(view: View) {
  const zoom = view.getZoom() || 0
  const resolution = view.getResolution() || Infinity
  const bbox = calculateViewportBbox(view)

  return {
    zoom,
    resolution,
    bbox,
  }
}

function getEndpoints() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  return {
    tileRating: `${baseUrl}feedback/rating`,
    tellUsMore: `${baseUrl}feedback/tell-us-more`,
  }
}

export default function useGlobalFeedback(mapRef: ShallowRef<Map | null>) {
  const { showError, showSuccess } = useNotifier()
  const { settings } = useSettings()
  const { tileRating: tileRatingEndpoint, tellUsMore: tellUsMoreEndpoint } = getEndpoints()

  const sliderValue = ref<number>(1)
  const hasInteractedWithSlider = ref(false)
  const detailsDialogOpen = ref(false)
  const tagsDialogOpen = ref(false)
  const selectedTags = ref<RatingTag[]>([])
  const isSubmittingQuick = ref(false)
  const isSubmittingDetails = ref(false)
  const mapZoom = ref<number>(0)
  const mapResolution = ref<number>(Infinity)
  const mapExtent = ref<[number, number, number, number] | null>(null)

  const detailsForm = ref<DetailedFeedbackForm>({
    qualityFeedback: '',
    useCase: '',
    name: '',
    email: '',
    organization: '',
  })

  const levelToSliderValue = (rating: FeedbackRating | null): number => {
    if (!rating) return 0
    const index = FEEDBACK_OPTIONS.findIndex((opt) => opt.rating === rating)
    return index >= 0 ? index : 0
  }

  const sliderValueToRating = (value: number): FeedbackRating | null => {
    if (value < 0 || value >= FEEDBACK_OPTIONS.length) return null
    return FEEDBACK_OPTIONS[value].rating
  }

  const selectedLevel = computed({
    get: () => sliderValueToRating(sliderValue.value),
    set: (rating: FeedbackRating | null) => {
      sliderValue.value = levelToSliderValue(rating)
    },
  })

  watch(sliderValue, () => {
    hasInteractedWithSlider.value = true
  })

  const canProvideFeedback = computed(() => {
    return mapZoom.value >= GLOBAL_DATA_MAP_COMPLETE_ZOOM_LEVEL
  })

  const isMediumZoom = computed(() => {
    return (
      mapZoom.value >= GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL &&
      mapZoom.value < GLOBAL_DATA_MAP_COMPLETE_ZOOM_LEVEL
    )
  })

  const zoomGateMessage = computed(() => {
    if (mapZoom.value < GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL) {
      return 'Zoom in to see fields and to give feedback.'
    }
    if (mapZoom.value < GLOBAL_DATA_MAP_COMPLETE_ZOOM_LEVEL) {
      return 'Zoom in more to see all fields and to give feedback.'
    }
    return ''
  })

  const canSubmitDetailed = computed(() => {
    return (
      Boolean(selectedLevel.value) &&
      detailsForm.value.qualityFeedback.trim().length > 0 &&
      detailsForm.value.useCase.trim().length > 0 &&
      isValidEmail(detailsForm.value.email)
    )
  })

  let viewEventKeys: EventsKey[] = []

  const syncMapState = () => {
    if (!mapRef.value) {
      return
    }
    const view = mapRef.value.getView()
    const state = getViewState(view)
    mapZoom.value = state.zoom
    mapResolution.value = state.resolution
    mapExtent.value = state.bbox
  }

  const unregisterViewEvents = () => {
    if (!viewEventKeys.length) {
      return
    }
    unByKey(viewEventKeys)
    viewEventKeys = []
  }

  const registerMapWatchers = (map: Map) => {
    unregisterViewEvents()
    const view = map.getView()
    viewEventKeys = [map.on('moveend', syncMapState), view.on('change:resolution', syncMapState)]
    syncMapState()
  }

  watch(
    mapRef,
    (map) => {
      if (!map) {
        unregisterViewEvents()
        return
      }
      registerMapWatchers(map)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    unregisterViewEvents()
  })

  const submitQuickFeedback = async () => {
    if (!canProvideFeedback.value) {
      showError(zoomGateMessage.value)
      return
    }

    if (!selectedLevel.value || !hasInteractedWithSlider.value || !mapExtent.value) {
      showError('Unable to submit feedback. Please try again.')
      return
    }

    selectedTags.value = []
    tagsDialogOpen.value = true
  }

  const closeTagsDialog = () => {
    tagsDialogOpen.value = false
  }

  const buildBaseRatingPayload = () => ({
    rating: selectedLevel.value,
    bbox: mapExtent.value,
    resolution: mapResolution.value,
    confidence_threshold: settings.value.threshold,
    year: settings.value.year,
    tags: selectedTags.value,
  })

  const postRating = async (): Promise<boolean> => {
    if (!canProvideFeedback.value) {
      showError(zoomGateMessage.value)
      return false
    }

    if (!selectedLevel.value || !mapExtent.value) {
      showError('Unable to submit feedback. Please try again.')
      return false
    }

    if (selectedTags.value.length === 0) {
      return false
    }

    isSubmittingQuick.value = true
    try {
      await postToEndpoint(tileRatingEndpoint, buildBaseRatingPayload())
      return true
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to submit feedback.')
      return false
    } finally {
      isSubmittingQuick.value = false
    }
  }

  const submitRatingWithTags = async () => {
    const ok = await postRating()
    if (ok) {
      showSuccess('Thanks for the feedback!')
      closeTagsDialog()
      hasInteractedWithSlider.value = false
    }
  }

  const openDetailsDialogFromTags = () => {
    closeTagsDialog()
    openDetailsDialog()
  }

  const openDetailsDialog = () => {
    if (!canProvideFeedback.value) {
      showError(zoomGateMessage.value)
      return
    }
    const stored = loadPersonalDetails()
    detailsForm.value.name = stored.name
    detailsForm.value.email = stored.email
    detailsForm.value.organization = stored.organization
    detailsDialogOpen.value = true
  }

  const closeDetailsDialog = () => {
    detailsDialogOpen.value = false
  }

  const resetDetailsForm = () => {
    detailsForm.value = {
      qualityFeedback: '',
      useCase: '',
      name: '',
      email: '',
      organization: '',
    }
  }

  const saveToLocalStorage = () => {
    savePersonalDetails({
      name: detailsForm.value.name,
      email: detailsForm.value.email,
      organization: detailsForm.value.organization,
    })
  }

  const submitDetailedFeedback = async () => {
    if (!canProvideFeedback.value) {
      showError(zoomGateMessage.value)
      return
    }
    if (
      !selectedLevel.value ||
      !detailsForm.value.qualityFeedback.trim() ||
      !detailsForm.value.useCase.trim()
    ) {
      showError('Please fill out the required fields before submitting.')
      return
    }
    if (!isValidEmail(detailsForm.value.email)) {
      showError('Please enter a valid email address, or leave it blank.')
      return
    }
    if (!mapExtent.value) {
      showError('Unable to submit feedback. Please try again.')
      return
    }

    isSubmittingDetails.value = true
    try {
      const payload: Record<string, unknown> = {
        ...buildBaseRatingPayload(),
        quality_feedback: detailsForm.value.qualityFeedback,
        use_case: detailsForm.value.useCase,
      }

      if (detailsForm.value.name) {
        payload.name = detailsForm.value.name
      }
      if (detailsForm.value.email) {
        payload.email = detailsForm.value.email
      }
      if (detailsForm.value.organization) {
        payload.organization = detailsForm.value.organization
      }

      saveToLocalStorage()

      await postToEndpoint(tellUsMoreEndpoint, payload)
      showSuccess('Detailed feedback submitted. Thank you!')

      closeDetailsDialog()
      resetDetailsForm()
      selectedTags.value = []
      hasInteractedWithSlider.value = false
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to submit detailed feedback.')
    } finally {
      isSubmittingDetails.value = false
    }
  }

  return {
    options: FEEDBACK_OPTIONS,
    sliderValue,
    hasInteractedWithSlider,
    selectedLevel,
    detailsDialogOpen,
    detailsForm,
    tagsDialogOpen,
    selectedTags,
    canProvideFeedback,
    isMediumZoom,
    zoomGateMessage,
    canSubmitDetailed,
    isSubmittingQuick,
    isSubmittingDetails,
    openDetailsDialog,
    closeDetailsDialog,
    openDetailsDialogFromTags,
    submitQuickFeedback,
    submitRatingWithTags,
    submitDetailedFeedback,
  }
}
