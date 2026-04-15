import { ref, shallowRef, watch, computed } from 'vue'
import type TileSource from 'ol/source/Tile'
import type Map from 'ol/Map'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import VectorTileLayer from 'ol/layer/VectorTile'
import GlTileLayer from 'ol/layer/WebGLTile.js'
import TileLayer from 'ol/layer/Tile'
import type XYZ from 'ol/source/XYZ'
import GeoJSON from 'ol/format/GeoJSON'
import { transformExtent } from 'ol/proj'
import type { Extent } from 'ol/extent'
import { type FeatureCollection } from 'geojson'
import useNotifier from './useNotifier'
import useSettings from './useSettings'
import createCloudlessLayer from '../layers/S2-Cloudless-Layer'
import createS2GridLayer from '../layers/S2-Grid-Layer'
import {
  createGlobalPredictionsLayer,
  updateGlobalPredictionsLayer,
} from '../layers/Global-Predictions-Layer'
import { Fill, Stroke, Style } from 'ol/style'
import { type FeatureLike } from 'ol/Feature'
import {
  createGlobalOverviewLayer,
  updateGlobalOverviewLayer,
} from '../layers/Global-Overview-Layers'
import { inferenceStyle } from '../layers/color-scales'

let featureId = 0

const loadingCount = ref(0)
export const isLayerLoading = computed(() => loadingCount.value > 0)

export function trackTileSource(source: TileSource): () => void {
  const onStart = () => {
    loadingCount.value++
  }
  const onEnd = () => {
    loadingCount.value = Math.max(0, loadingCount.value - 1)
  }
  source.on('tileloadstart', onStart)
  source.on(['tileloadend', 'tileloaderror'], onEnd)
  return () => {
    source.un('tileloadstart', onStart)
    source.un(['tileloadend', 'tileloaderror'], onEnd)
  }
}

export interface AreaValues {
  min_area_km2: number
  max_area_km2: number
  default?: boolean
}

const { settings } = useSettings()

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
const selectedFeatureLayer = shallowRef<'vector' | 'global-predictions' | null>(null)

const hidePropertiesBox = () => {
  showPropertiesBox.value = false
  selectedFeature.value = null
  selectedFeatureLayer.value = null
  propertiesBoxPosition.value = null
  originalClickPosition.value = null
}

export const geoJsonResults = shallowRef<any[]>([])

// Cloudless layer management
const cloudlessLayer = shallowRef<TileLayer<XYZ> | null>(null)

let untrackCloudless: (() => void) | null = null
watch(cloudlessLayer, (newLayer) => {
  untrackCloudless?.()
  const src = newLayer?.getSource() as TileSource | null
  untrackCloudless = src ? trackTileSource(src) : null
})

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

    if (settings.value.mode === 'global') {
      if (globalPredictionsLayer.value) {
        map.value.removeLayer(globalPredictionsLayer.value)
        globalPredictionsLayer.value = null
      }

      globalPredictionsLayer.value = createGlobalPredictionsLayer(settings.value)
      map.value.addLayer(globalPredictionsLayer.value)
    }
  },
)

const initCloudlessLayer = () => {
  if (!map.value) {
    return
  }
  cloudlessLayer.value = createCloudlessLayer(settings.value.year)
  map.value.getLayers().insertAt(0, cloudlessLayer.value)
}

// Global predictions and S2 grid layer management
const s2GridLayer = shallowRef<VectorLayer<VectorSource> | null>(null)
const globalPredictionsLayer = shallowRef<VectorTileLayer | null>(null)
const globalOverviewLayer = shallowRef<GlTileLayer | null>(null)

let untrackGlobalPredictions: (() => void) | null = null
watch(globalPredictionsLayer, (newLayer) => {
  untrackGlobalPredictions?.()
  const src = newLayer?.getSource() as TileSource | null
  untrackGlobalPredictions = src ? trackTileSource(src) : null
})

let untrackGlobalOverview: (() => void) | null = null
watch(globalOverviewLayer, (newLayer) => {
  untrackGlobalOverview?.()
  const src = newLayer?.getSource() as TileSource | null
  untrackGlobalOverview = src ? trackTileSource(src) : null
})

watch(
  () => settings.value.threshold,
  () => {
    if (globalOverviewLayer.value) {
      updateGlobalOverviewLayer(globalOverviewLayer.value, settings.value)
    }
    if (globalPredictionsLayer.value) {
      updateGlobalPredictionsLayer(globalPredictionsLayer.value, settings.value)
    }
  },
)

const updateAggregateLayer = () => {
  if (!map.value) {
    return
  }
  if (globalOverviewLayer.value) {
    map.value.removeLayer(globalOverviewLayer.value)
    globalOverviewLayer.value = null
  }

  if (settings.value.aggregate) {
    globalOverviewLayer.value = createGlobalOverviewLayer(settings.value)
    map.value.addLayer(globalOverviewLayer.value)
  }
}

watch(() => settings.value.aggregate, updateAggregateLayer)

const updateLayers = () => {
  if (!map.value) {
    return
  }

  if (settings.value.mode === 'global') {
    if (s2GridLayer.value) {
      map.value.removeLayer(s2GridLayer.value)
      s2GridLayer.value = null
    }

    // Initialize with global predictions layers
    if (!globalPredictionsLayer.value) {
      // Only handle first initialization here, year changes are handled by a watcher on year above
      globalPredictionsLayer.value = createGlobalPredictionsLayer(settings.value)
      map.value.addLayer(globalPredictionsLayer.value)
    }
    if (settings.value.aggregate) {
      if (!globalOverviewLayer.value) {
        globalOverviewLayer.value = createGlobalOverviewLayer(settings.value)
        map.value.addLayer(globalOverviewLayer.value)
      }
    } else {
      if (globalOverviewLayer.value) {
        map.value.removeLayer(globalOverviewLayer.value)
        globalOverviewLayer.value = null
      }
    }
  } else {
    // Initialize with S2 grid layer
    if (!s2GridLayer.value) {
      s2GridLayer.value = createS2GridLayer()
      map.value.addLayer(s2GridLayer.value)
    }

    // Remove global predictions layers if they exist
    if (globalPredictionsLayer.value) {
      map.value.removeLayer(globalPredictionsLayer.value)
      globalPredictionsLayer.value = null
      if (selectedFeatureLayer.value === 'global-predictions') {
        hidePropertiesBox()
      }
    }
    if (globalOverviewLayer.value) {
      map.value.removeLayer(globalOverviewLayer.value)
      globalOverviewLayer.value = null
    }
  }
}

watch(() => settings.value.mode, updateLayers)

// Hide properties box when zooming out below PMTiles minZoom
const GLOBAL_PREDICTIONS_MIN_ZOOM = 10
function handleMoveEnd() {
  if (selectedFeatureLayer.value === 'global-predictions') {
    const zoom = map.value?.getView().getZoom()
    if (zoom !== undefined && zoom < GLOBAL_PREDICTIONS_MIN_ZOOM) {
      hidePropertiesBox()
    }
  }
}
watch(map, (newMap, oldMap) => {
  if (oldMap) oldMap.un('moveend', handleMoveEnd)
  if (newMap) newMap.on('moveend', handleMoveEnd)
})

const featureStyle = new Style({
  fill: new Fill({
    color: inferenceStyle.fill,
  }),
  stroke: new Stroke({
    color: inferenceStyle.stroke,
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

    // Check vectorLayer first (processing results take priority)
    if (vectorLayer.value) {
      const [clickedFeature] = map.value!.getFeaturesAtPixel(pixel, {
        layerFilter: (layer) => layer === vectorLayer.value,
      })
      if (clickedFeature) {
        selectedFeature.value = clickedFeature
        selectedFeatureLayer.value = 'vector'
        originalClickPosition.value = { x: pixel[0], y: pixel[1] }
        propertiesBoxPosition.value = calculateOptimalPosition(pixel[0], pixel[1])
        showPropertiesBox.value = true
        return
      }
    }

    // Check globalPredictionsLayer (PMTiles field boundaries)
    if (globalPredictionsLayer.value) {
      const [clickedFeature] = map.value!.getFeaturesAtPixel(pixel, {
        layerFilter: (layer) => layer === globalPredictionsLayer.value,
      })
      if (clickedFeature) {
        selectedFeature.value = clickedFeature
        selectedFeatureLayer.value = 'global-predictions'
        originalClickPosition.value = { x: pixel[0], y: pixel[1] }
        propertiesBoxPosition.value = calculateOptimalPosition(pixel[0], pixel[1])
        showPropertiesBox.value = true
        return
      }
    }

    // Clicked outside all relevant features
    hidePropertiesBox()
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
    updateLayers,
    isLayerLoading,
  }
}
