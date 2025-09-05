import { Feature, type Map } from 'ol'
import { never } from 'ol/events/condition'
import {
  buffer,
  containsCoordinate,
  getHeight,
  getIntersection,
  getWidth,
  type Extent,
} from 'ol/extent'
import ExtentInteraction from 'ol/interaction/Extent'
import { Fill, Stroke, Style } from 'ol/style'
import { ref, type Ref, shallowRef } from 'vue'
import type DataCabinet from '../components/DataCabinet.vue'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Polygon, { fromExtent } from 'ol/geom/Polygon'
import { transformExtent } from 'ol/proj'
import { getArea } from 'ol/sphere'
import { showWarning } from '../functions/snackbar'
import { booleanWithin as turfBooleanWithin } from '@turf/boolean-within'
import { useSearch, type SearchResults } from './useSearch'
import { Feature as GeoJSONFeature, Polygon as GeoJSONPolygon } from 'geojson'
import { usePermalink } from './usePermalink'

const { clearSearchResults, searchResults } = useSearch()
const { updateTileSelection } = usePermalink()

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
const currentMgrsTileId = ref<string | null>(null)
const activeTileId = ref<string | null>(null)
const secondActiveTileId = ref<string | null>(null)
/** Full grid extent */
const currentGridExtent = ref<Extent | null>(null)
/** User bbox */
const drawnExtent = ref<Extent | null>(null)
/** Flag to block map clicks when results are displayed */
const blockMapClicks = ref(false)

const extentFeature: Feature<Polygon> = new Feature()
extentFeature.on('change', () => {
  const bbox = extentFeature.getGeometry()?.getExtent() || null
  drawnExtent.value = bbox // Update the drawn extent in the composable
})

const drawVectorLayer: VectorLayer<VectorSource> = new VectorLayer({
  source: new VectorSource({
    features: [extentFeature],
  }),
  zIndex: 1001,
})

function addExtentInteraction(
  map: Map,
  bboxExtent: Extent,
  areaValues: { min_area_km2: number; max_area_km2: number },
  searchResults: SearchResults,
) {
  extentInteraction.value = new ExtentInteraction({
    extent: bboxExtent,
    createCondition: never,
    drag: true,
    boxStyle: new Style({
      fill: new Fill({
        color: 'rgba(255, 255, 255, 0.2)',
      }),
    }),
  })
  map.addInteraction(extentInteraction.value)

  let warningShown = false

  extentInteraction.value.on('extentchanged', (event) => {
    const newExtent = event.extent
    const geometry = fromExtent(newExtent)

    const area = calculateArea(geometry)
    const isWithinExtent = currentGridExtent.value
      ? isPolygonWithinExtent(geometry, currentGridExtent.value)
      : false
    // Check if the polygon is within the grid extent and within size limits

    if (area > areaValues?.max_area_km2 || area < areaValues?.min_area_km2 || !isWithinExtent) {
      if (!warningShown) {
        // Show notification for each validation error
        if (area > areaValues?.max_area_km2) {
          showWarning(
            `Bounding box area exceeds ${areaValues?.max_area_km2} square kilometers. Using last valid state.`,
          )
        }
        if (area < areaValues?.min_area_km2) {
          showWarning(
            `Bounding box area is less than ${areaValues?.min_area_km2} square kilometers. Using last valid state.`,
          )
        }
        if (!isWithinExtent) {
          showWarning(
            'Running inference across Sentinel 2 tile boundaries is not yet supported. Move your bbox to the selected tile, or select a different tile.',
          )
        }
        warningShown = true
        drawVectorLayer?.setStyle(invalidStyle)
      }
    } else {
      warningShown = false
      extentFeature.setGeometry(geometry)
      drawVectorLayer.setStyle(validStyle)

      // Check geometry containment if both tiles are selected
      checkBboxContainment(newExtent, drawnExtent, searchResults)
    }
  })

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
function calculateArea(geometry: Polygon): number {
  // Transform to EPSG:4326 for accurate area calculation
  const area = getArea(geometry, { projection: 'EPSG:3857' })
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

const checkBboxContainment = (
  extent: Extent,
  drawnExtent: Ref<Extent | null>,
  searchResults: SearchResults,
) => {
  const currentExtent = extent || drawnExtent.value
  if (!activeTileId.value || !secondActiveTileId.value || !currentExtent) {
    return
  }

  const firstTile = searchResults.value.find((result) => result.id === activeTileId.value)
  const secondTile = searchResults.value.find((result) => result.id === secondActiveTileId.value)

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
  dataCabinetRef: Ref<InstanceType<typeof DataCabinet> | null>,
  areaValues: { min_area_km2: number; max_area_km2: number },
  drawnExtent: Ref<Extent | null>,
  searchResults: SearchResults,
  handleSearchResults: (mgrsTileId: string, bbox?: number[], settings?: any) => void,
) {
  // Add click handler
  map?.on('click', (event) => {
    // Block map clicks if results are displayed
    if (blockMapClicks.value) {
      return
    }

    removeExtentInteraction()

    const feature = map.forEachFeatureAtPixel(event.pixel, (feature) => feature)

    if (feature) {
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
          // Get current settings from localStorage to apply to the search
          const stored = localStorage.getItem('ftw-search-settings')
          let currentSettings = {
            startDate: '',
            endDate: '',
            cloudCover: 10,
            areaCoverage: 60,
          }

          if (stored) {
            try {
              const parsed = JSON.parse(stored)
              currentSettings = {
                startDate: parsed.startDate || '',
                endDate: parsed.endDate || '',
                cloudCover: parsed.cloudCover || 10,
                areaCoverage: parsed.areaCoverage || 60,
              }
            } catch (error) {
              console.error('Error parsing stored settings:', error)
            }
          }

          handleSearchResults(currentMgrsTileId.value, bbox, currentSettings)
          // Open the Batch Processing accordion
          if (dataCabinetRef.value?.handleProcessingToggle) {
            dataCabinetRef.value.handleProcessingToggle(true)
          }
        } else {
          console.error('S2 Grid Layer: Current MGRS Tile ID is null')
        }

        // Add the layer and interactions
        if (!map.getLayers().getArray().includes(drawVectorLayer)) {
          map.addLayer(drawVectorLayer)
        }

        // Create and add Modify interaction with size restriction
        addExtentInteraction(map, bboxExtent, areaValues, searchResults)
      }
    } else {
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
function triggerTileSelection(
  map: Map,
  mgrsTileId: string,
  dataCabinetRef: Ref<InstanceType<typeof DataCabinet> | null>,
  areaValues: { min_area_km2: number; max_area_km2: number },
  handleSearchResults: (mgrsTileId: string, bbox?: number[], settings?: any) => void,
) {
  // Set the current MGRS tile ID
  currentMgrsTileId.value = mgrsTileId

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
      const bboxExtent = calculateBoundingBox(extent, areaValues)

      // Set initial bounding box
      const bboxPolygon = fromExtent(bboxExtent)
      extentFeature.setGeometry(bboxPolygon)

      if (!map.getLayers().getArray().includes(drawVectorLayer)) {
        map.addLayer(drawVectorLayer)
      }

      // Adjust draw vector layer extent and style
      drawVectorLayer.setExtent(currentGridExtent.value!)
      drawVectorLayer.setStyle(validStyle)

      // Create and add Modify interaction with size restriction
      addExtentInteraction(map, bboxExtent, areaValues, searchResults)

      // Add padding to the extent for view fitting
      const padding = 50
      const paddedExtent = buffer(extent, padding)

      // Fit the view to the extent
      map.getView().fit(paddedExtent, {
        duration: 1000,
        maxZoom: 13,
      })

      // Create a smaller bbox within the grid to avoid overlap with adjacent grids
      const gridWidth = extent[2] - extent[0]
      const gridHeight = extent[3] - extent[1]
      const shrinkFactor = 0.15 // 15% shrink from each side (70% total)

      const bbox = [
        extent[0] + gridWidth * shrinkFactor, // minLon
        extent[1] + gridHeight * shrinkFactor, // minLat
        extent[2] - gridWidth * shrinkFactor, // maxLon
        extent[3] - gridHeight * shrinkFactor, // maxLat
      ]

      // Call the search function
      if (currentMgrsTileId.value) {
        // Get current settings from localStorage to apply to the search
        const stored = localStorage.getItem('ftw-search-settings')
        let currentSettings = {
          startDate: '',
          endDate: '',
          cloudCover: 10,
          areaCoverage: 60,
        }

        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            currentSettings = {
              startDate: parsed.startDate || '',
              endDate: parsed.endDate || '',
              cloudCover: parsed.cloudCover || 10,
              areaCoverage: parsed.areaCoverage || 60,
            }
          } catch (error) {
            console.error('Error parsing stored settings:', error)
          }
        }

        handleSearchResults(currentMgrsTileId.value, bbox, currentSettings)

        // Open the Batch Processing accordion
        if (dataCabinetRef.value?.handleProcessingToggle) {
          dataCabinetRef.value.handleProcessingToggle(true)
        }
      }

      // Add the layer and interactions
      if (!map.getLayers().getArray().includes(drawVectorLayer)) {
        map.addLayer(drawVectorLayer)
      }
    }
  }
}

export function useAreaOfInterest() {
  return {
    drawnExtent,
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
    updatePermalink: (map: Map) => {
      updateTileSelection(
        map,
        currentMgrsTileId.value,
        activeTileId.value,
        secondActiveTileId.value,
      )
    },
  }
}
