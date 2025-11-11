import type Map from 'ol/Map'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import { formatMeasurementDisplay } from '../functions/format-measurement-display'
import { ref, shallowRef } from 'vue'

export const map = shallowRef<Map | null>(null)
export const areaValues = ref<{ min_area_km2: number; max_area_km2: number } | null>(null)
export const vectorLayer = shallowRef<VectorLayer<VectorSource> | null>(null)

// Properties display state
export const selectedFeature = ref<any>(null)
export const propertiesBoxPosition = ref<{ x: number; y: number } | null>(null)
export const originalClickPosition = ref<{ x: number; y: number } | null>(null)
export const showPropertiesBox = ref(false)

export const handleMapClick = (event: any) => {
  // Check if click is on a feature from our vector layer
  const pixel = event.pixel
  let clickedFeature: any = null

  // Check if we clicked on a feature from our results layer
  map.value?.forEachFeatureAtPixel(pixel, (feature) => {
    // Only process features from our results layer
    if (
      vectorLayer.value
        ?.getSource()
        ?.getFeatures()
        .includes(feature as any)
    ) {
      clickedFeature = feature
      return true // Stop after finding a feature from our results layer
    }
    return false // Continue checking other features
  })

  if (clickedFeature) {
    // Clicked on a feature from our results layer
    selectedFeature.value = clickedFeature
    const properties = clickedFeature.getProperties()
    // Remove geometry and other non-property fields
    const { geometry, ...cleanProperties } = properties
    selectedFeature.value.cleanProperties = Object.entries(cleanProperties).map(([key, value]) => {
      return {
        key,
        value,
        formattedValue: formatMeasurementDisplay(value as string | number, key),
      }
    })
    // Store original click position for arrow indicator
    originalClickPosition.value = { x: pixel[0], y: pixel[1] }

    // Calculate optimal position for the properties box to avoid screen edges
    const optimalPosition = calculateOptimalPosition(pixel[0], pixel[1])
    propertiesBoxPosition.value = optimalPosition
    showPropertiesBox.value = true
  } else {
    // Clicked outside our results layer features, hide properties box
    hidePropertiesBox()
  }
}

export const hidePropertiesBox = () => {
  showPropertiesBox.value = false
  selectedFeature.value = null
  propertiesBoxPosition.value = null
  originalClickPosition.value = null
}

export const calculateOptimalPosition = (clickX: number, clickY: number) => {
  const boxWidth = 300 // Approximate width of properties box
  const boxHeight = 200 // Approximate height of properties box
  const margin = 20 // Minimum margin from screen edges

  let optimalX = clickX
  let optimalY = clickY

  // Get viewport dimensions
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Adjust X position if too close to right edge
  if (clickX + boxWidth + margin > viewportWidth) {
    optimalX = clickX - boxWidth - margin
  }

  // Adjust X position if too close to left edge
  if (optimalX < margin) {
    optimalX = margin
  }

  // Adjust Y position if too close to bottom edge
  if (clickY + boxHeight + margin > viewportHeight) {
    optimalY = clickY - boxHeight - margin
  }

  // Adjust Y position if too close to top edge
  if (optimalY < margin) {
    optimalY = margin
  }

  return { x: optimalX, y: optimalY }
}

export function useMap() {
  return {
    map,
    areaValues,
    vectorLayer,
    maxArea: 3000,
    handleMapClick,
    hidePropertiesBox,
    calculateOptimalPosition,
    selectedFeature,
    propertiesBoxPosition,
    originalClickPosition,
    showPropertiesBox,
  }
}
