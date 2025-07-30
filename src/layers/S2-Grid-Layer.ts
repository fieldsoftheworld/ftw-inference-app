import { Map } from 'ol'
import type { Extent } from 'ol/extent'
import { containsCoordinate, buffer } from 'ol/extent'
import Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON.js'
import { fromExtent } from 'ol/geom/Polygon.js'
import { Geometry, Polygon } from 'ol/geom'
import ExtentInteraction from 'ol/interaction/Extent'
import VectorLayer from 'ol/layer/Vector.js'
import { transformExtent } from 'ol/proj'
import VectorSource from 'ol/source/Vector.js'
import { getArea } from 'ol/sphere'
import { getArea as getAreaExtent } from 'ol/extent'
import { Fill, Stroke, Style } from 'ol/style.js'
import type { Ref } from 'vue'
import type DataCabinet from '../components/DataCabinet.vue'
import s2GridData from '../data/s2-grid.json'
import { showWarning } from '../functions/snackbar'
import { never } from 'ol/events/condition'

let drawVectorLayer: VectorLayer<VectorSource> | null = null
let extentInteraction: ExtentInteraction | null = null
let currentGridExtent: Extent | null = null

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

export default function createS2GridLayer(
  map: Map,
  dataCabinetRef: Ref<InstanceType<typeof DataCabinet> | null>,
  areaValues: { min_area_km2: number; max_area_km2: number },
) {
  const layer = new VectorLayer({
    source: new VectorSource({
      features: new GeoJSON({
        dataProjection: 'urn:ogc:def:crs:OGC:1.3:CRS84',
        featureProjection: 'EPSG:3857',
      }).readFeatures(s2GridData) as Feature<Geometry>[],
    }),
    zIndex: 1000,
    style: new Style({
      stroke: new Stroke({
        color: 'rgba(0, 136, 136, 1)', // Green color
        width: 1,
      }),
      fill: new Fill({
        color: 'rgba(0, 136, 136, 0.1)', // Very light green fill with transparency
      }),
    }),
  })

  // Add click handler
  map?.on('click', (event) => {
    // Clean up previous interaction
    if (extentInteraction) {
      //@ts-ignore
      extentInteraction.setMap(null)
      map.removeInteraction(extentInteraction)
      extentInteraction.dispose()
    }

    const feature = map.forEachFeatureAtPixel(event.pixel, (feature) => feature)

    if (feature) {
      // Get the MGRS Tile ID from the feature properties
      const mgrsTileId = feature.get('Name')

      // If the clicked feature is the same as the current tile, don't do anything
      if (!mgrsTileId || dataCabinetRef.value?.currentMgrsTileId === mgrsTileId) {
        return
      }

      // Clear any existing drawVectorLayer
      map.getLayers().forEach((layer) => {
        if (layer.get('name') === 'drawVectorLayer') {
          map.removeLayer(layer)
        }
      })

      // Get the feature's extent
      const geometry = feature.getGeometry()
      if (geometry) {
        const extent = geometry.getExtent()
        currentGridExtent = extent // Store the current grid extent
        // Calculate the bounding box based on area values
        const bboxExtent = calculateBoundingBox(extent, areaValues)

        // Create a polygon feature for the bounding box
        const bboxPolygon = fromExtent(bboxExtent)

        // Create the initial feature
        const initialFeature = new Feature({
          geometry: bboxPolygon,
          name: 'drawVectorLayer',
        })

        // Create vector source with the initial bounding box
        const drawVectorsource = new VectorSource()
        drawVectorsource.on('change', () => {
          const feature = drawVectorsource
            .getFeatures()
            .find((f) => f.get('name') === 'drawVectorLayer')
          if (!feature) {
            return
          }
          const bbox = feature.getGeometry()?.getExtent()
          if (!bbox) {
            return
          }
          dataCabinetRef.value?.setDrawnExtent(bbox)
        })
        drawVectorsource.addFeature(initialFeature)

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

        // Create and add the draw vector layer
        drawVectorLayer = new VectorLayer({
          source: drawVectorsource,
          properties: {
            name: 'drawVectorLayer',
          },
          extent: currentGridExtent,
          style: validStyle,
          zIndex: 1001,
        })

        // Add padding to the extent for view fitting
        const padding = 50
        const paddedExtent = buffer(extent, padding)

        // Fit the view to the extent
        map.getView().fit(paddedExtent, {
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
        if (dataCabinetRef.value?.handleSearchResults) {
          dataCabinetRef.value.handleSearchResults(mgrsTileId, bbox, currentGridExtent)
          // Open the Batch Processing accordion
          if (dataCabinetRef.value?.handleBatchProcessingToggle) {
            dataCabinetRef.value.handleBatchProcessingToggle(true)
          }
        } else {
          console.error('S2 Grid Layer: DataCabinet ref not available')
        }

        // Add the layer and interactions
        map.addLayer(drawVectorLayer)

        // Create and add Modify interaction with size restriction
        extentInteraction = new ExtentInteraction({
          extent: bboxExtent,
          createCondition: never,
          drag: true,
          boxStyle: new Style({
            fill: new Fill({
              color: 'rgba(255, 255, 255, 0.2)',
            }),
          }),
        })

        let warningShown = false

        extentInteraction.on('extentchanged', (event) => {
          const newExtent = event.extent
          const geometry = fromExtent(newExtent)

          const area = calculateArea(geometry)
          const isWithinExtent = currentGridExtent
            ? isPolygonWithinExtent(geometry, currentGridExtent)
            : false
          // Check if the polygon is within the grid extent and within size limits

          if (
            area > areaValues?.max_area_km2 ||
            area < areaValues?.min_area_km2 ||
            !isWithinExtent
          ) {
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
            initialFeature.setGeometry(geometry)
            drawVectorLayer?.setStyle(validStyle)
          }
        })

        map.addInteraction(extentInteraction)
      }
    } else {
      // If clicked outside a feature, clear the selection
      if (drawVectorLayer) {
        map.removeLayer(drawVectorLayer)
        drawVectorLayer.getSource()?.dispose()
      }
      currentGridExtent = null
    }
  })

  return layer
}
