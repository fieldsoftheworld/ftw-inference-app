import { Map } from 'ol'
import type { Extent } from 'ol/extent'
import { containsCoordinate } from 'ol/extent'
import Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON.js'
import { Geometry, Polygon } from 'ol/geom'
import Interaction from 'ol/interaction/Interaction'
import Modify from 'ol/interaction/Modify'
import VectorLayer from 'ol/layer/Vector.js'
import { transformExtent } from 'ol/proj'
import VectorSource from 'ol/source/Vector.js'
import { getArea } from 'ol/sphere'
import { Fill, Stroke, Style } from 'ol/style.js'
import type { Ref } from 'vue'
import type DataCabinet from '../components/DataCabinet.vue'
import s2GridData from '../data/s2-grid.json'
import { showWarning } from '../functions/snackbar'

let snap: Interaction | null = null
const drawVectorLayer: VectorLayer<VectorSource> | null = null
let currentFeature: Feature<Polygon> | null = null
let currentGridExtent: Extent | null = null

// Function to check if all coordinates of a polygon are within an extent
function isPolygonWithinExtent(polygon: Polygon, extent: Extent): boolean {
  const coordinates = polygon.getCoordinates()[0]
  return coordinates.every((coord) => containsCoordinate(extent, coord))
}

// Function to calculate area in square kilometers
function calculateArea(geometry: Polygon): number {
  // Transform to EPSG:4326 for accurate area calculation
  const area = getArea(geometry.clone(), { projection: 'EPSG:3857' })
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
        const bboxPolygon = new Polygon([
          [
            [bboxExtent[0], bboxExtent[1]],
            [bboxExtent[2], bboxExtent[1]],
            [bboxExtent[2], bboxExtent[3]],
            [bboxExtent[0], bboxExtent[3]],
            [bboxExtent[0], bboxExtent[1]],
          ],
        ])

        // Create vector source with the initial bounding box
        const drawVectorsource = new VectorSource({
          features: [
            new Feature({
              geometry: bboxPolygon,
              properties: {
                name: 'drawVectorLayer',
              },
            }),
          ],
        })

        // Create and add the draw vector layer
        const drawVectorLayer = new VectorLayer({
          source: drawVectorsource,
          properties: {
            name: 'drawVectorLayer',
          },
          extent: currentGridExtent,
          style: (feature) => {
            const area = calculateArea(feature.getGeometry() as Polygon)
            const isWithinExtent = isPolygonWithinExtent(
              feature.getGeometry() as Polygon,
              currentGridExtent as Extent,
            )
            if (
              area > areaValues?.max_area_km2 ||
              area < areaValues?.min_area_km2 ||
              !isWithinExtent
            ) {
              return new Style({
                stroke: new Stroke({
                  color: 'rgba(255, 255, 0, 1)',
                  width: 2,
                }),
                fill: new Fill({
                  color: 'rgba(255, 255, 0, 0.1)',
                }),
              })
            } else {
              return new Style({
                stroke: new Stroke({
                  color: 'rgba(0, 136, 136, 1)',
                  width: 2,
                }),
                fill: new Fill({
                  color: 'rgba(0, 136, 136, 0.1)',
                }),
              })
            }
          },
          zIndex: 1001,
        })

        // Add padding to the extent for view fitting
        const padding = 50
        const paddedExtent: Extent = [
          extent[0] - padding,
          extent[1] - padding,
          extent[2] + padding,
          extent[3] + padding,
        ]

        // Fit the view to the extent
        map.getView().fit(paddedExtent, {
          duration: 1000,
          maxZoom: 13,
        })

        // Call the search function through the ref and open the Batch Processing accordion
        if (dataCabinetRef.value?.handleSearchResults) {
          dataCabinetRef.value.handleSearchResults(mgrsTileId)
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
        const modify = new Modify({
          source: drawVectorsource,
        })

        // Store the initial feature
        modify.on('modifystart', (event) => {
          const features = event.features.getArray()
          if (features.length > 0) {
            currentFeature = features[0].clone() as Feature<Polygon>
          }
        })

        modify.on('modifyend', (event) => {
          const features = event.features.getArray()
          if (features.length > 0 && currentGridExtent) {
            const geometry = features[0].getGeometry() as Polygon
            const area = calculateArea(geometry)
            const isWithinExtent = isPolygonWithinExtent(geometry, currentGridExtent)
            // Check if the polygon is within the grid extent and within size limits
            if (
              area > areaValues?.max_area_km2 ||
              area < areaValues?.min_area_km2 ||
              !isWithinExtent
            ) {
              // If area exceeds limits or is outside grid, revert to the last valid state
              if (currentFeature) {
                // Create a new feature from the current valid state
                const validFeature = currentFeature.clone()
                drawVectorsource.clear()
                drawVectorsource.addFeature(validFeature)

                // Update the current feature reference
                currentFeature = validFeature

                // Show notification if area was too large or too small
                if (area > areaValues?.max_area_km2) {
                  showWarning(
                    `Bounding box area exceeds ${areaValues?.max_area_km2} square kilometers. Resizing to last valid state.`,
                  )
                } else if (area < areaValues?.min_area_km2) {
                  showWarning(
                    `Bounding box area is less than ${areaValues?.min_area_km2} square kilometers. Resizing to last valid state.`,
                  )
                } else if (!isWithinExtent) {
                  showWarning(
                    'Bounding box is outside the selected grid area. Resizing to last valid state.',
                  )
                }
              } else {
                // If no valid state exists, reset to the initial bounding box
                const bboxExtent = calculateBoundingBox(currentGridExtent, areaValues)
                const bboxPolygon = new Polygon([
                  [
                    [bboxExtent[0], bboxExtent[1]],
                    [bboxExtent[2], bboxExtent[1]],
                    [bboxExtent[2], bboxExtent[3]],
                    [bboxExtent[0], bboxExtent[3]],
                    [bboxExtent[0], bboxExtent[1]],
                  ],
                ])
                const newFeature = new Feature({
                  geometry: bboxPolygon,
                  properties: {
                    name: 'drawVectorLayer',
                  },
                })
                drawVectorsource.clear()
                drawVectorsource.addFeature(newFeature)
                currentFeature = newFeature

                // Show notification for reset to initial bbox
                if (area > areaValues?.max_area_km2) {
                  showWarning(
                    `Bounding box area exceeds ${areaValues?.max_area_km2} square kilometers. Resetting to initial size.`,
                  )
                } else if (area < areaValues?.min_area_km2) {
                  showWarning(
                    `Bounding box area is less than ${areaValues?.min_area_km2} square kilometers. Resetting to initial size.`,
                  )
                } else if (!isWithinExtent) {
                  showWarning(
                    'Bounding box is outside the selected grid area. Resetting to initial size.',
                  )
                }
              }
            } else {
              // Update the current valid state
              currentFeature = features[0].clone() as Feature<Polygon>
            }
          }
        })

        map.addInteraction(modify)
      }
    } else {
      // If clicked outside a feature, clear the selection
      if (snap && drawVectorLayer) {
        map.removeInteraction(snap)
        map.removeLayer(drawVectorLayer)
        currentFeature = null
        currentGridExtent = null
      }
    }
  })

  return layer
}
