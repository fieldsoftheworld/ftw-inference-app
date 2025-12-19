import { ref, shallowRef, watch } from 'vue'
import type Map from 'ol/Map'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import TileLayer from 'ol/layer/Tile'
import type XYZ from 'ol/source/XYZ'
import GeoJSON from 'ol/format/GeoJSON'
import { transformExtent } from 'ol/proj'
import type { Extent } from 'ol/extent'
import { type FeatureCollection } from 'geojson'
import useNotifier from './useNotifier'
import useSettings from './useSettings'
import createCloudlessLayer from '../layers/S2-Cloudless-Layer'
import { Fill, Stroke, Style } from 'ol/style'
import { type FeatureLike } from 'ol/Feature'

let featureId = 0

export interface AreaValues {
  min_area_km2: number
  max_area_km2: number
  default?: boolean
}

export const map = shallowRef<Map | null>(null)
const areaValues = ref<AreaValues>({
  min_area_km2: 100,
  max_area_km2: 500,
  default: true,
})
const vectorLayer = shallowRef<VectorLayer<VectorSource> | null>(null)

// Properties display state
const selectedFeature = shallowRef<FeatureLike | null>(null)
watch(selectedFeature, () => vectorLayer.value?.changed())
const propertiesBoxPosition = ref<{ x: number; y: number } | null>(null)
const originalClickPosition = ref<{ x: number; y: number } | null>(null)
const showPropertiesBox = ref(false)

const geoJsonResults = shallowRef<any[]>([])

// Cloudless layer management
const cloudlessLayer = shallowRef<TileLayer<XYZ> | null>(null)
const { settings } = useSettings()

// Watch for year changes and update the cloudless layer
watch(
  () => settings.value.year,
  (newYear) => {
    if (!map.value) {
      return
    }

    // Remove the old cloudless layer if it exists
    if (cloudlessLayer.value) {
      map.value.removeLayer(cloudlessLayer.value)
    }

    // Create and add the new cloudless layer with the updated year
    cloudlessLayer.value = createCloudlessLayer(newYear)
    // Insert at index 0 to keep it as the base layer
    map.value.getLayers().insertAt(0, cloudlessLayer.value)
  },
)

const initCloudlessLayer = () => {
  if (!map.value) {
    return
  }
  cloudlessLayer.value = createCloudlessLayer(settings.value.year)
  map.value.getLayers().insertAt(0, cloudlessLayer.value)
}

const featureStyle = new Style({
  fill: new Fill({
    color: 'rgba(255, 255, 0, 0.1)',
  }),
  stroke: new Stroke({
    color: 'rgba(255, 255, 0, 1)',
    width: 2,
  }),
})

const highlightStyle = [
  featureStyle,
  new Style({
    stroke: new Stroke({
      color: 'rgba(255, 0, 0, 1)',
      width: 1.5,
    }),
  }),
]

export default function useMap() {
  const { showWarning } = useNotifier()

  const handleMapClick = (event: any) => {
    // Check if click is on a feature from our vector layer
    const pixel = event.pixel

    // Check if we clicked on a feature from our results layer
    const [clickedFeature] = map.value!.getFeaturesAtPixel(pixel, {
      layerFilter: (layer) => layer === vectorLayer.value,
    })

    if (clickedFeature) {
      // Clicked on a feature from our results layer
      selectedFeature.value = clickedFeature

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

  const hidePropertiesBox = () => {
    showPropertiesBox.value = false
    selectedFeature.value = null
    propertiesBoxPosition.value = null
    originalClickPosition.value = null
  }

  const calculateOptimalPosition = (clickX: number, clickY: number) => {
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

  const fitMapToBbox = (bbox: number[]) => {
    // Validate bbox before processing
    if (!bbox || bbox.length !== 4 || bbox.some((coord) => isNaN(coord) || coord === 0)) {
      console.warn('Invalid bbox provided to fitMapToBbox:', bbox)
      return
    }

    const extent: Extent = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857')

    // Validate transformed extent
    if (!extent || extent.some((coord) => isNaN(coord))) {
      console.warn('Invalid transformed extent:', extent)
      return
    }

    // TODO: FIX ISSUE WITH SCROLLING AND CHANGE LAYER COLOR
    map.value!.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 500,
    })
  }

  const displayGeoJSON = (
    geojson: FeatureCollection & { crs: { properties: { name: string } } },
  ) => {
    // Remove existing vector layer if it exists
    if (vectorLayer.value) {
      map.value!.removeLayer(vectorLayer.value)
    }
    for (const feature of geojson.features) {
      if (feature.id === undefined) {
        feature.id =
          feature.properties?.id !== undefined ? feature.properties.id : `feature-${featureId++}`
      }
    }

    // Create new vector source and layer
    const source = new VectorSource({
      features: new GeoJSON({
        dataProjection: geojson.crs.properties.name,
        featureProjection: 'EPSG:3857',
      }).readFeatures(geojson),
    })

    // Check if we have valid features
    if (source.getFeatures().length === 0) {
      showWarning(
        'No valid features found in the processing results. Please try again with a different area or settings.',
      )
      return null
    }

    vectorLayer.value = new VectorLayer({
      source: source,
      style: (feature) => {
        if (feature === selectedFeature.value) {
          return highlightStyle
        }
        return featureStyle
      },
      zIndex: 1001, // Higher than S2-grid-layer (1000)
    })

    // Ensure the results layer is on top by setting a high z-index
    map.value!.addLayer(vectorLayer.value)

    geoJsonResults.value = geojson.features

    // Get the extent and validate it
    const extent = source.getExtent()
    if (!extent || extent.every((coord) => coord === 0) || extent.some((coord) => isNaN(coord))) {
      showWarning(
        'Invalid extent generated from processing results. Please try again with a different area or settings.',
      )
      return null
    }

    return transformExtent(extent, 'EPSG:3857', 'EPSG:4326')
  }

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
    fitMapToBbox,
    displayGeoJSON,
    geoJsonResults,
    initCloudlessLayer,
  }
}
