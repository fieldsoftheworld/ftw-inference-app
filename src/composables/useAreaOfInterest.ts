import { Feature, type Map } from 'ol'
import { never } from 'ol/events/condition'
import {
  buffer,
  containsCoordinate,
  getHeight,
  getIntersection,
  getWidth,
  isEmpty,
  type Extent,
} from 'ol/extent'
import ExtentInteraction from 'ol/interaction/Extent'
import { Fill, Stroke, Style } from 'ol/style'
import { nextTick, ref, type Ref, shallowRef, watch } from 'vue'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Polygon, { fromExtent } from 'ol/geom/Polygon'
import { transformExtent } from 'ol/proj'
import { getArea } from 'ol/sphere'
import { showWarning } from '../composables/useSnackbar'
import { booleanWithin as turfBooleanWithin } from '@turf/boolean-within'
import { clearSearchResults, SearchResult, searchResults } from './useSearch'
import { Feature as GeoJSONFeature, Polygon as GeoJSONPolygon } from 'geojson'
import { areaValues, map, useMap } from './useMap'
import { useProcessingMode } from './useProcessingMode'
import { autoSceneSelection, useSettings } from './useSettings'
import { tileDataFromStacFeature } from '../functions/search-stac-api'
import { debounce } from 'vuetify/lib/util/helpers.mjs'

const invalidStyle = new Style({
  stroke: new Stroke({
    color: 'rgba(255, 255, 0, 1)',
    width: 2,
  }),
  fill: new Fill({
    color: 'rgba(255, 255, 0, 0.1)',
  }),
})

const validStyle = new Style({
  stroke: new Stroke({
    color: 'rgba(0, 136, 136, 1)',
    width: 2,
  }),
  fill: new Fill({
    color: 'rgba(0, 136, 136, 0.1)',
  }),
})

const extentInteraction = shallowRef<ExtentInteraction | null>(null)
export const currentMgrsTileId = ref<string | null>(null)
export const activeTileId = ref<string | null>(null)
export const secondActiveTileId = ref<string | null>(null)
/** Full grid extent */
const currentGridExtent = shallowRef<Extent | null>(null)
/** User bbox */
export const drawnExtent = shallowRef<Extent | null>(null)
const currentDrawnExtent = shallowRef<Polygon | undefined>(undefined)
/** Flag to block map clicks when results are displayed */
const blockMapClicks = ref(false)
const { settings } = useSettings()
const { maxArea } = useMap()
const { updateProcessingMode } = useProcessingMode()

const extentFeature: Feature<Polygon> = new Feature()

let updatingDrawnExtent = false
watch(
  drawnExtent,
  (newValue) => {
    if (updatingDrawnExtent) {
      return
    }
    updatingDrawnExtent = true
    extentFeature.setGeometry(newValue ? fromExtent(newValue) : undefined)
    if (newValue) {
      extentInteraction.value?.setExtent(newValue)
    }
    updatingDrawnExtent = false
  },
  { immediate: true },
)

extentFeature.on('change', () => {
  if (updatingDrawnExtent) {
    return
  }
  const bbox = extentFeature?.getGeometry()?.getExtent() || null
  updatingDrawnExtent = true
  drawnExtent.value = bbox // Update the drawn extent in the composable
  nextTick(() => {
    updatingDrawnExtent = false
  })
})

const drawVectorLayer: VectorLayer<VectorSource> = new VectorLayer({
  source: new VectorSource({
    features: [extentFeature],
  }),
  zIndex: 1001,
})

function addExtentInteraction() {
  extentInteraction.value = new ExtentInteraction({
    extent: drawnExtent.value || undefined,
    createCondition: never,
    drag: true,
    boxStyle: [
      new Style({
        stroke: new Stroke({
          color: 'white',
          width: 2.5,
        }),
      }),
      new Style({
        stroke: new Stroke({
          color: 'rgba(0, 136, 136, 1)',
          width: 2,
        }),
      }),
    ],
  })
  map.value!.addInteraction(extentInteraction.value)

  extentInteraction.value.on(
    'extentchanged',
    debounce((event) => {
      const newExtent = event.extent
      const geometry = fromExtent(newExtent)
      currentDrawnExtent.value = geometry

      const area = calculateArea(geometry)
      const isWithinExtent = currentGridExtent.value
        ? isPolygonWithinExtent(geometry, currentGridExtent.value)
        : false

      // Define area limits based on processing mode
      const minArea = areaValues.value!.min_area_km2

      // Check if the polygon is within the grid extent and within size limits
      if (area > maxArea || area < minArea || !isWithinExtent) {
        if (!isWithinExtent) {
          showWarning(
            'Running inference across Sentinel 2 tile boundaries is not yet supported. Move your bbox to the selected tile, or select a different tile.',
          )
        }
        drawVectorLayer?.setStyle(invalidStyle)
      } else {
        extentFeature.setGeometry(geometry)
        drawVectorLayer.setStyle(validStyle)

        updateProcessingMode(area, areaValues)

        if (!autoSceneSelection.value) {
          // Check geometry containment if both tiles are selected
          checkBboxContainment(newExtent, drawnExtent)
        }
      }
    }, 500),
  )

  return extentInteraction.value
}

function removeExtentInteraction() {
  if (!extentInteraction.value) {
    return
  }
  // Clean up interaction
  const map = extentInteraction.value.getMap()
  // @ts-ignore
  extentInteraction.value.setMap(null)
  if (map) {
    map.removeInteraction(extentInteraction.value)
  }
  extentInteraction.value.dispose()
  extentInteraction.value = null
}

function removeDrawVectorLayer(map: Map) {
  if (drawVectorLayer && map.getLayers().getArray().includes(drawVectorLayer)) {
    map.removeLayer(drawVectorLayer)
    drawVectorLayer.getSource()?.dispose()
  }
}

function setBlockMapClicks(block: boolean) {
  blockMapClicks.value = block
}

function clearResultsAndZoomToGrid(map: Map) {
  // Clear the results by setting blockMapClicks to false
  blockMapClicks.value = false

  // Remove the GeoJSON results layer from the map
  const layers = map.getLayers().getArray()
  const resultsLayer = layers.find(
    (layer) =>
      // Look for the layer with zIndex 1001 (our GeoJSON results layer)
      (layer as any).getZIndex &&
      (layer as any).getZIndex() === 1001 &&
      (layer as any).getSource &&
      (layer as any).getSource() &&
      typeof (layer as any).getSource().getFeatures === 'function',
  )

  if (resultsLayer) {
    map.removeLayer(resultsLayer)
    // Dispose of the layer source to free memory
    if ((resultsLayer as any).getSource) {
      ;(resultsLayer as any).getSource().dispose()
    }
  }

  // Store the current grid extent before clearing it
  const gridExtent = currentGridExtent.value

  // Clear search results
  clearSearchResults()

  // Reset S2 grid selection state
  currentMgrsTileId.value = null
  activeTileId.value = null
  secondActiveTileId.value = null
  currentGridExtent.value = null
  drawnExtent.value = null

  // Remove the draw vector layer if it exists
  removeDrawVectorLayer(map)

  // Zoom back to the stored grid extent if available
  if (gridExtent) {
    const padding = 50
    const paddedExtent = buffer(gridExtent, padding)

    map.getView().fit(paddedExtent, {
      duration: 1000,
      maxZoom: 13,
    })
  }
}

// Function to check if all coordinates of a polygon are within an extent
function isPolygonWithinExtent(polygon: Polygon, extent: Extent): boolean {
  const coordinates = polygon.getCoordinates()[0]
  return coordinates.every((coord) => containsCoordinate(extent, coord))
}

// Function to calculate area in square kilometers
function calculateArea(geometry: Polygon, convertProjection: boolean = true): number {
  // Transform to EPSG:4326 for accurate area calculation
  const area = getArea(geometry, { projection: convertProjection ? 'EPSG:3857' : 'EPSG:4326' })
  return area / 1000000 // Convert to square kilometers
}

// Function to calculate a bounding box within the selected grid based on area values
function calculateBoundingBox(
  extent: Extent,
  areaValues: { min_area_km2: number; max_area_km2: number },
): Extent {
  // Convert extent to EPSG:4326 for area calculation
  const wgs84Extent = transformExtent(extent, 'EPSG:3857', 'EPSG:4326')

  // Calculate center point
  const centerX = (wgs84Extent[0] + wgs84Extent[2]) / 2
  const centerY = (wgs84Extent[1] + wgs84Extent[3]) / 2

  // Calculate the size of the box in degrees
  // At the equator, 1 degree is approximately 111.32 km
  // Use the min area value if available, otherwise use 200 sq km
  const targetArea = (areaValues?.min_area_km2 + areaValues?.max_area_km2) / 2
  const sideLengthKm = Math.sqrt(targetArea)
  const sideLengthDegrees = sideLengthKm / 111.32

  // Create the new extent
  const newExtent: Extent = [
    centerX - sideLengthDegrees / 2,
    centerY - sideLengthDegrees / 2,
    centerX + sideLengthDegrees / 2,
    centerY + sideLengthDegrees / 2,
  ]

  // Transform back to EPSG:3857
  return transformExtent(newExtent, 'EPSG:4326', 'EPSG:3857')
}

const checkBboxContainment = async (extent: Extent, drawnExtent: Ref<Extent | null>) => {
  const currentExtent = extent || drawnExtent.value
  if (!activeTileId.value || !secondActiveTileId.value || !currentExtent) {
    return
  }

  const firstTile = await getTileById(activeTileId.value)
  const secondTile = await getTileById(secondActiveTileId.value)

  if (!firstTile?.geometry || !secondTile?.geometry) {
    return
  }

  // Create the intersection from the geometries to see if the bbox is contained within
  const tilePolygons: GeoJSONFeature<GeoJSONPolygon>[] = [firstTile, secondTile].map((f) => ({
    type: 'Feature',
    properties: null,
    geometry: f.geometry as GeoJSONPolygon, // c'mon, TypeScript, you know the geometry is not null, we checked it above
  }))

  // Convert drawn extent to GeoJSON bbox format [minX, minY, maxX, maxY]
  const bbox = transformExtent(currentExtent, 'EPSG:3857', 'EPSG:4326')
  const bboxPolygon: GeoJSONFeature<GeoJSONPolygon> = {
    type: 'Feature',
    properties: null,
    geometry: { type: 'Polygon', coordinates: fromExtent(bbox).getCoordinates() },
  }
  // Check if the bbox is contained within both tile polygons
  const isContained = tilePolygons.every((tilePolygon) =>
    turfBooleanWithin(bboxPolygon, tilePolygon),
  )

  if (!isContained) {
    showWarning(
      'The selected area (bbox) is not fully contained within the selected tiles. Please try a different area.',
    )
  }
}

function addMapClickHandler(
  map: Map,
  areaValues: { min_area_km2: number; max_area_km2: number },
  handleSearchResults: (bbox?: number[], settings?: any) => Promise<void>,
) {
  // Add click handler
  map?.on('click', (event) => {
    // Block map clicks if results are displayed
    if (blockMapClicks.value) {
      return
    }

    removeExtentInteraction()

    const features = map.getFeaturesAtPixel(event.pixel)

    let extentFound = false
    for (const feature of features) {
      // Get the MGRS Tile ID from the feature properties
      const mgrsTileId = feature.get('Name')
      currentMgrsTileId.value = mgrsTileId

      // If the clicked feature is the same as the current tile, don't do anything
      if (!mgrsTileId || currentMgrsTileId === mgrsTileId) {
        return
      }

      // Get the feature's extent
      const geometry = feature.getGeometry()
      if (geometry) {
        const extent = geometry.getExtent()
        currentGridExtent.value = extent // Store the current grid extent
        // Calculate the bounding box based on area values
        const extentAtClickedPosition = [
          event.coordinate[0] - getWidth(extent) / 2,
          event.coordinate[1] - getHeight(extent) / 2,
          event.coordinate[0] + getWidth(extent) / 2,
          event.coordinate[1] + getHeight(extent) / 2,
        ]
        const bboxExtent = getIntersection(
          extent,
          calculateBoundingBox(extentAtClickedPosition, areaValues),
        )
        if (isEmpty(bboxExtent)) {
          continue
        }

        // Set initial bounding box
        const bboxPolygon = fromExtent(bboxExtent)
        extentFeature.setGeometry(bboxPolygon)

        // Adjust draw vector layer extent and style
        drawVectorLayer.setExtent(currentGridExtent.value)
        drawVectorLayer.setStyle(validStyle)

        // Add padding to the extent for view fitting
        const padding = 50

        // Fit the view to the extent
        map.getView().fit(extentAtClickedPosition, {
          padding: [padding, padding, padding, padding],
          duration: 1000,
          maxZoom: 13,
        })

        // Create a smaller bbox within the grid to avoid overlap with adjacent grids
        // Use 70% of the grid extent centered within the grid
        const gridWidth = extent[2] - extent[0]
        const gridHeight = extent[3] - extent[1]
        const shrinkFactor = 0.15 // 15% shrink from each side (70% total)

        const bbox = [
          extent[0] + gridWidth * shrinkFactor, // minLon
          extent[1] + gridHeight * shrinkFactor, // minLat
          extent[2] - gridWidth * shrinkFactor, // maxLon
          extent[3] - gridHeight * shrinkFactor, // maxLat
        ]

        // Call the search function through the ref and open the Batch Processing accordion
        if (currentMgrsTileId.value) {
          handleSearchResults(bbox, settings.value)
        } else {
          console.error('S2 Grid Layer: Current MGRS Tile ID is null')
        }

        // Add the layer and interactions
        if (!map.getLayers().getArray().includes(drawVectorLayer)) {
          map.addLayer(drawVectorLayer)
        }

        // Create and add Modify interaction with size restriction
        addExtentInteraction()
        extentFound = true
        break
      }
    }
    if (!extentFound) {
      // If clicked outside a feature, clear the selection
      if (drawVectorLayer) {
        map.removeLayer(drawVectorLayer)
        drawVectorLayer.getSource()?.dispose()
      }
      currentGridExtent.value = null
    }
  })
}

// Function to programmatically trigger tile selection and search
export async function triggerTileSelection(
  map: Map,
  mgrsTileId: string,
  areaValues: { min_area_km2: number; max_area_km2: number },
  handleSearchResults: (bbox?: number[], settings?: any) => Promise<void>,
  bbox?: number[],
  fit: boolean = true,
) {
  // Set the current MGRS tile ID
  currentMgrsTileId.value = mgrsTileId
  removeExtentInteraction()

  // Find the feature on the map with this MGRS tile ID
  const layers = map.getLayers().getArray()
  let targetFeature: any = null

  for (const layer of layers) {
    // Check if this is a vector layer with features
    if ('getSource' in layer && typeof (layer as any).getSource === 'function') {
      const source = (layer as any).getSource()
      if (source && typeof source.getFeatures === 'function') {
        const features = source.getFeatures()
        targetFeature = features.find((f: any) => f.get('Name') === mgrsTileId)
        if (targetFeature) break
      }
    }
  }

  if (targetFeature) {
    // Get the feature's extent
    const geometry = targetFeature.getGeometry()
    if (geometry) {
      const extent = geometry.getExtent()
      currentGridExtent.value = extent

      // Calculate the bounding box based on area values
      let bboxExtent: Extent
      if (bbox) {
        // Convert bbox from WGS84 (EPSG:4326) to Web Mercator (EPSG:3857)
        bboxExtent = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857')
      } else {
        bboxExtent = calculateBoundingBox(extent, areaValues)
      }
      // Set initial bounding box
      const bboxPolygon = fromExtent(bboxExtent)
      extentFeature.setGeometry(bboxPolygon)
      // Adjust draw vector layer extent and style
      drawVectorLayer.setExtent(currentGridExtent.value!)
      drawVectorLayer.setStyle(validStyle)

      // Add padding to the extent for view fitting
      const padding = 50
      const paddedExtent = buffer(extent, padding)

      // Fit the view to the extent
      if (fit) {
        map.getView().fit(paddedExtent, {
          duration: 1000,
          maxZoom: 13,
        })
      }

      // Use provided bbox or create a smaller bbox within the grid to avoid overlap with adjacent grids
      let finalBbox: number[]

      if (bbox) {
        // Use the provided bbox
        finalBbox = bbox
      } else {
        // Create a smaller bbox within the grid to avoid overlap with adjacent grids
        const gridWidth = extent[2] - extent[0]
        const gridHeight = extent[3] - extent[1]
        const shrinkFactor = 0.15 // 15% shrink from each side (70% total)

        finalBbox = [
          extent[0] + gridWidth * shrinkFactor, // minLon
          extent[1] + gridHeight * shrinkFactor, // minLat
          extent[2] - gridWidth * shrinkFactor, // maxLon
          extent[3] - gridHeight * shrinkFactor, // maxLat
        ]
      }

      // Call the search function
      if (currentMgrsTileId.value) {
        await handleSearchResults(finalBbox, settings.value)
      }
      // Add the layer and interactions
      if (!layers.includes(drawVectorLayer)) {
        map.addLayer(drawVectorLayer)
      }
      addExtentInteraction()
    }
  }
}

export const getTileById = async (tileId: string): Promise<SearchResult | null> => {
  let tile = searchResults.value.find((result) => result.id === tileId)
  if (!tile) {
    const base = 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/'
    const url = base + tileId
    try {
      const response = await fetch(url)
      const json = await response.json()
      tile = tileDataFromStacFeature(json)
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error fetching tile with id ${tileId}: ${error.message}`)
      }
    }
  }
  return tile ?? null
}

function getHemisphere(utmTile: string | null) {
  if (!utmTile) {
    return null
  }
  // Example input: "39UWA"
  const match = utmTile.match(/^(\d+)([A-Z])/)
  if (!match) throw new Error('Invalid UTM tile format')

  const latitudeBand = match[2]

  // 2. Letters N through X (except O) are in the Northern Hemisphere.
  //    Letters C through M are in the Southern Hemisphere.
  const northern = 'RSTUVWXY' // UTM uses C–X (skips I and O)
  const southern = 'CDEFGHJ'
  const equatorial = 'KLMNPQ'

  if (northern.includes(latitudeBand)) {
    return 'N'
  } else if (southern.includes(latitudeBand)) {
    return 'S'
  } else if (equatorial.includes(latitudeBand)) {
    return null
  }
  throw new Error('Invalid latitude band in UTM tile')
}

export function useAreaOfInterest() {
  return {
    maxArea,
    drawnExtent,
    extentFeature,
    addExtentInteraction,
    removeExtentInteraction,
    removeDrawVectorLayer,
    addMapClickHandler,
    currentMgrsTileId,
    currentGridExtent,
    activeTileId,
    secondActiveTileId,
    setBlockMapClicks,
    clearResultsAndZoomToGrid,
    triggerTileSelection,
    calculateArea,
    getTileById,
    getHemisphere,
  }
}
