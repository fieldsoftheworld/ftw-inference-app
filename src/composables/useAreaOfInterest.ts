import { Feature, type Map } from 'ol'
import { never } from 'ol/events/condition'
import {
  buffer,
  getCenter,
  getHeight,
  getIntersection,
  getWidth,
  isEmpty,
  type Extent,
} from 'ol/extent'
import ExtentInteraction from 'ol/interaction/Extent'
import { Fill, Stroke, Style } from 'ol/style'
import { nextTick, ref, type Ref, shallowRef, watch } from 'vue'
import Polygon, { fromExtent } from 'ol/geom/Polygon'
import { transformExtent } from 'ol/proj'
import { getArea } from 'ol/sphere'
import { booleanWithin as turfBooleanWithin } from '@turf/boolean-within'
import type { Feature as GeoJSONFeature, Polygon as GeoJSONPolygon } from 'geojson'
import useMap, { type AreaValues } from './useMap'
import useNotifier from './useNotifier'
import useProcessingMode from './useProcessingMode'
import useSearch, { type SearchResult } from './useSearch'
import useSettings from './useSettings'
import { tileDataFromStacFeature } from '../functions/search-stac-api'
import { debounce } from 'vuetify/lib/util/helpers.mjs'

const extentInteraction = shallowRef<ExtentInteraction | null>(null)
const currentMgrsTileId = ref<string | null>(null)
const activeTileId = ref<string | null>(null)
const secondActiveTileId = ref<string | null>(null)
/** Full grid extent */
const currentGridExtent = shallowRef<Extent | null>(null)
/** User bbox */
const currentBBox = ref<number[] | undefined>(undefined) // bbox in EPSG:4326
const currentBBoxValid = ref<string | boolean>(false)
const drawnExtent = shallowRef<Extent | null>(null) // bbox in EPSG:3857
/** Flag to block map clicks when results are displayed */
const blockMapClicks = ref(false)

const extentFeature: Feature<Polygon> = new Feature()

const invalidStyle = new Style({
  stroke: new Stroke({
    color: 'rgba(255, 0, 0, 1)',
    width: 2,
  }),
  fill: new Fill({
    color: 'rgba(0, 136, 136, 0.1)',
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

// Everything in this composable is module level, nothing is per-invocation
let moduleLevelComposable: any = null

export default function useAreaOfInterest() {
  if (moduleLevelComposable) {
    // No need to create watchers, functions, etc. again
    return moduleLevelComposable
  }

  const { searchResults } = useSearch()
  const { settings, modelIsSingleShot } = useSettings()
  const { maxArea, vectorLayer, areaValues, geoJsonResults, map } = useMap()
  const { updateProcessingMode } = useProcessingMode()
  const { showWarning, showError } = useNotifier()

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

  function addExtentInteraction(map: Map, areaValues: AreaValues) {
    if (extentInteraction.value) {
      return
    }
    extentInteraction.value = new ExtentInteraction({
      extent: drawnExtent.value || undefined,
      createCondition: never,
      drag: true,
      boxStyle: validStyle,
    })
    map.addInteraction(extentInteraction.value)

    extentInteraction.value.on('extentchanged', (event: any) => {
      const layer = event.target.extentOverlay_
      const bbox = transformExtent(event.extent, 'EPSG:3857', 'EPSG:4326')
      if (validateBBox(bbox, true, false)) {
        layer.setStyle(validStyle)
      } else {
        layer.setStyle(invalidStyle)
      }
    })

    extentInteraction.value.on(
      'extentchanged',
      debounce((event: any) => {
        drawnExtent.value = event.extent
        const bbox = transformExtent(event.extent, 'EPSG:3857', 'EPSG:4326')
        if (validateBBox(bbox)) {
          const [feature] = map.getFeaturesAtPixel(
            map.getPixelFromCoordinate(getCenter(event.extent)),
            { layerFilter: (l) => l.get('name') === 's2-grid' },
          )
          currentMgrsTileId.value = feature ? feature.get('Name') : null

          currentBBox.value = bbox
          if (!settings.value.autoSceneSelection) {
            // Check geometry containment if both tiles are selected
            // todo: What is this used for?
            checkBboxContainment(event.extent, drawnExtent)
          }
        }

        const area = calculateArea(bbox)
        updateProcessingMode(area, areaValues)
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

  function clearResultsAndZoomToGrid(map: Map) {
    geoJsonResults.value = []

    // Remove the GeoJSON results layer from the map
    if (vectorLayer.value) {
      map.removeLayer(vectorLayer.value)
      // Dispose of the layer source to free memory
      if (vectorLayer.value.getSource) {
        vectorLayer.value.getSource()!.dispose()
      }
    }

    // Zoom back to the stored grid extent if available
    if (currentGridExtent.value) {
      const padding = 50
      const paddedExtent = buffer(currentGridExtent.value, padding)

      map.getView().fit(paddedExtent, {
        duration: 1000,
        maxZoom: 13,
      })
    }
  }

  watch(geoJsonResults, (newResults) => {
    if (newResults.length > 0) {
      blockMapClicks.value = true
      removeExtentInteraction()
    } else {
      blockMapClicks.value = false
      addExtentInteraction(map.value!, areaValues.value)
    }
  })

  // Function to calculate area in square kilometers
  function calculateArea(bbox: Extent): number {
    const geometry = fromExtent(bbox)
    const area = getArea(geometry, { projection: 'EPSG:4326' })
    return area / 1000000 // Convert to square kilometers
  }

  // Function to calculate a bounding box within the selected grid based on area values
  function calculateBoundingBox(extent: Extent, areaValues: AreaValues): Extent {
    // Convert extent to EPSG:4326 for area calculation
    const wgs84Extent = transformExtent(extent, 'EPSG:3857', 'EPSG:4326')

    // Calculate center point
    const centerX = (wgs84Extent[0] + wgs84Extent[2]) / 2
    const centerY = (wgs84Extent[1] + wgs84Extent[3]) / 2

    // Calculate the size of the box in degrees
    // At the equator, 1 degree is approximately 111.32 km
    // Use the min area value if available, otherwise use 200 sq km
    const targetArea = (areaValues.min_area_km2 + areaValues.max_area_km2) / 2
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
    if (
      !activeTileId.value ||
      (!modelIsSingleShot.value && !secondActiveTileId.value) ||
      !currentExtent
    ) {
      return
    }

    const tiles = [await getTileById(activeTileId.value)]
    if (!modelIsSingleShot.value && secondActiveTileId.value) {
      tiles.push(await getTileById(secondActiveTileId.value))
    }

    // Create the intersection from the geometries to see if the bbox is contained within
    const tilePolygons: GeoJSONFeature<GeoJSONPolygon>[] = tiles
      .filter((tile) => tile?.geometry)
      .map((f) => ({
        type: 'Feature',
        properties: null,
        geometry: f!.geometry as GeoJSONPolygon, // c'mon, TypeScript, you know feature and geometry are not null, we filtered it above
      }))

    if (!tilePolygons.length) {
      return
    }

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
        'The selected area is not fully contained within the selected tiles. Please try a different area.',
      )
    }
  }

  function isBBox(bbox: any): boolean {
    if (!Array.isArray(bbox) || bbox.length !== 4) {
      return false
    }
    const [minX, minY, maxX, maxY] = bbox
    return (
      typeof minX === 'number' &&
      typeof minY === 'number' &&
      typeof maxX === 'number' &&
      typeof maxY === 'number' &&
      minX >= -180 &&
      maxX <= 180 &&
      minY >= -90 &&
      maxY <= 90 &&
      minX < maxX &&
      minY < maxY
    )
  }

  function validateBBox(bbox: Extent, silent: boolean = false, checkBBox: boolean = true): boolean {
    if (checkBBox && !isBBox(bbox)) {
      const message = 'The provided area of interest is invalid. Please check the coordinates.'
      if (!silent && !settings.value.expertMode) {
        showError(message)
      }
      currentBBoxValid.value = message
      return false
    }

    const area = calculateArea(bbox)

    if (area < areaValues.value.min_area_km2) {
      const message = `The selected area of interest is below the minimum threshold of ${areaValues.value.min_area_km2} km². Please select a larger area.`
      if (!silent) {
        showError(message)
      }
      currentBBoxValid.value = message
      return false
    }
    if (area > maxArea) {
      const message = `The selected area of interest exceeds the maximum limit of ${maxArea} km². Please select a smaller area.`
      if (!silent) {
        showError(message)
      }
      currentBBoxValid.value = message
      return false
    }

    currentBBoxValid.value = true
    return true
  }

  function addBBoxAtPixel(pixel: number[], map: Map, areaValues: AreaValues) {
    removeExtentInteraction()

    const features = map.getFeaturesAtPixel(pixel, {
      layerFilter: (layer) => layer.get('name') === 's2-grid',
    })
    const coordinate = map.getCoordinateFromPixel(pixel)

    let extentFound = false
    for (const feature of features) {
      // Get the MGRS Tile ID from the feature properties
      const mgrsTileId = feature.get('Name')
      if (!mgrsTileId) {
        continue
      }

      // Set the current MGRS tile ID
      currentMgrsTileId.value = mgrsTileId

      // Get the feature's extent (i.e. the MGRS grid tile extent)
      const geometry = feature.getGeometry()
      if (geometry) {
        const extent = geometry.getExtent()
        currentGridExtent.value = extent // Store the current grid extent
        // Calculate the bounding box based on area values
        const extentAtClickedPosition = [
          coordinate[0] - getWidth(extent) / 2,
          coordinate[1] - getHeight(extent) / 2,
          coordinate[0] + getWidth(extent) / 2,
          coordinate[1] + getHeight(extent) / 2,
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
        drawnExtent.value = bboxExtent
        currentBBox.value = transformExtent(bboxExtent, 'EPSG:3857', 'EPSG:4326')
        validateBBox(currentBBox.value)

        // Add padding to the extent for view fitting
        const padding = 50

        // Fit the view to the extent
        map.getView().fit(extentAtClickedPosition, {
          padding: [padding, padding, padding, padding],
          duration: 1000,
          maxZoom: 13,
        })

        // Create and add Modify interaction with size restriction
        addExtentInteraction(map, areaValues)
        extentFound = true
        break
      }
    }
    if (!extentFound) {
      currentGridExtent.value = null
    }
  }

  function addMapClickHandler(map: Map, areaValues: AreaValues) {
    // Add click handler
    map.on('click', (event) => {
      // Block map clicks if results are displayed
      if (blockMapClicks.value) {
        return
      }

      addBBoxAtPixel(event.pixel, map, areaValues)
    })
  }

  // Function to programmatically trigger tile selection and search
  async function triggerTileSelection(
    map: Map,
    mgrsTileId: string,
    areaValues: AreaValues,
    handleSearchResults: (utmTile: string | null, bbox?: number[], settings?: any) => Promise<void>,
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
          await handleSearchResults(currentMgrsTileId.value, finalBbox, settings.value)
        }
        addExtentInteraction(map, areaValues)
      }
    }
  }

  const getTileById = async (tileId: string): Promise<SearchResult | null> => {
    let tile = searchResults.value.find((result) => result.id === tileId)
    if (!tile) {
      const base = 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/'
      const url = base + tileId
      try {
        const response = await fetch(url)
        const json = await response.json()
        if (response.ok && json) {
          tile = tileDataFromStacFeature(json)
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error fetching tile with id ${tileId}: ${error.message}`)
        }
      }
    }
    return tile ?? null
  }

  moduleLevelComposable = {
    maxArea,
    drawnExtent,
    currentBBox,
    currentBBoxValid,
    extentFeature,
    addBBoxAtPixel,
    addExtentInteraction,
    removeExtentInteraction,
    addMapClickHandler,
    currentMgrsTileId,
    currentGridExtent,
    activeTileId,
    secondActiveTileId,
    clearResultsAndZoomToGrid,
    triggerTileSelection,
    calculateArea,
    getTileById,
    isBBox,
    validateBBox,
  }
  return moduleLevelComposable
}
