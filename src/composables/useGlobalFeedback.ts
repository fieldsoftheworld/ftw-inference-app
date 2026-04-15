import { computed, onBeforeUnmount, ref, type ShallowRef, watch } from 'vue'
import type Map from 'ol/Map'
import type View from 'ol/View'
import { toLonLat } from 'ol/proj'
import { unByKey } from 'ol/Observable'
import type { EventsKey } from 'ol/events'
import useNotifier from './useNotifier'
import {
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

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  {
    rating: 1,
    title: 'Not Great',
    description: "These fields won't work for me",
  },
  {
    rating: 2,
    title: 'Somewhat OK',
    description: 'I can use these fields, but they need some work',
  },
  {
    rating: 3,
    title: 'Great!',
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
    tileRating: `${baseUrl}feedback/tile-rating`,
    tellUsMore: `${baseUrl}feedback/tell-us-more`,
  }
}

export default function useGlobalFeedback(mapRef: ShallowRef<Map | null>) {
  const { showError, showSuccess } = useNotifier()
  const { tileRating: tileRatingEndpoint, tellUsMore: tellUsMoreEndpoint } = getEndpoints()

  const sliderValue = ref<number>(1)
  const detailsDialogOpen = ref(false)
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

  const canProvideFeedback = computed(() => {
    return mapZoom.value >= GLOBAL_DATA_MAP_COMPLETE_ZOOM_LEVEL
  })

  const zoomGateMessage = computed(() => {
    if (mapZoom.value < GLOBAL_DATA_MAP_FIELD_START_ZOOM_LEVEL) {
      return 'Zoom in to see the fields and to be able to give feedback.'
    }
    if (mapZoom.value < GLOBAL_DATA_MAP_COMPLETE_ZOOM_LEVEL) {
      return 'Zoom in more to show all fields and to be able to give feedback.'
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

    if (!selectedLevel.value || !mapExtent.value) {
      showError('Unable to submit feedback. Please try again.')
      return
    }

    isSubmittingQuick.value = true
    try {
      const payload = {
        rating: selectedLevel.value,
        bbox: mapExtent.value,
        resolution: mapResolution.value,
      }
      await postToEndpoint(tileRatingEndpoint, payload)
      showSuccess('Thanks for the feedback!')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to submit feedback.')
    } finally {
      isSubmittingQuick.value = false
    }
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
    if (!selectedLevel.value) {
      showError('Please select one of the options before submitting.')
      return
    }
    if (!detailsForm.value.qualityFeedback.trim() || !detailsForm.value.useCase.trim()) {
      showError('Please fill in the required fields before submitting.')
      return
    }
    if (!isValidEmail(detailsForm.value.email)) {
      showError('Please provide a valid email address.')
      return
    }
    if (!mapExtent.value) {
      showError('Unable to submit feedback. Please try again.')
      return
    }

    isSubmittingDetails.value = true
    try {
      const payload: Record<string, unknown> = {
        quality_feedback: detailsForm.value.qualityFeedback,
        use_case: detailsForm.value.useCase,
        rating: selectedLevel.value,
        bbox: mapExtent.value,
        resolution: mapResolution.value,
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
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to submit detailed feedback.')
    } finally {
      isSubmittingDetails.value = false
    }
  }

  return {
    options: FEEDBACK_OPTIONS,
    sliderValue,
    selectedLevel,
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
  }
}
