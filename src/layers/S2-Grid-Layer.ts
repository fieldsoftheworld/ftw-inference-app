import GeoJSON from 'ol/format/GeoJSON.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import { Fill, Stroke, Style } from 'ol/style.js'
import s2GridData from '../data/s2-grid.json'
import { Map } from 'ol'
import type { Ref } from 'vue'
import type DataCabinet from '../components/DataCabinet.vue'
import { Extent } from 'ol/extent'
import { transformExtent } from 'ol/proj'
import { Geometry, Polygon } from 'ol/geom'
import Feature from 'ol/Feature'
import Snap from 'ol/interaction/Snap'
import Modify from 'ol/interaction/Modify'
import Interaction from 'ol/interaction/Interaction'
import { getArea } from 'ol/sphere'
import { containsCoordinate } from 'ol/extent'

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

// Function to calculate a 500 sq. km. bounding box within the selected grid
function calculateBoundingBox(extent: Extent): Extent {
  // Convert extent to EPSG:4326 for area calculation
  const wgs84Extent = transformExtent(extent, 'EPSG:3857', 'EPSG:4326')

  // Calculate center point
  const centerX = (wgs84Extent[0] + wgs84Extent[2]) / 2
  const centerY = (wgs84Extent[1] + wgs84Extent[3]) / 2

  // Calculate the size of the box in degrees
  // At the equator, 1 degree is approximately 111.32 km
  // We want 500 sq. km., so we'll use a square root to get the side length
  const sideLengthKm = Math.sqrt(500)
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

      // Get the feature's extent
      const geometry = feature.getGeometry()
      if (geometry) {
        const extent = geometry.getExtent()
        currentGridExtent = extent // Store the current grid extent

        // Calculate the 500 sq. km. bounding box
        const bboxExtent = calculateBoundingBox(extent)

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
          }),
          // Create and add the draw vector layer
          drawVectorLayer = new VectorLayer({
            source: drawVectorsource,
            properties: {
              name: 'drawVectorLayer',
            },
            extent: currentGridExtent,
            style: new Style({
              stroke: new Stroke({
                color: 'rgba(0, 136, 136, 1)',
                width: 2,
              }),
              fill: new Fill({
                color: 'rgba(0, 136, 136, 0.1)',
              }),
            }),
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

        // Call the search function through the ref and open the Run Inference accordion
        if (dataCabinetRef.value?.handleSearchResults) {
          dataCabinetRef.value.handleSearchResults(mgrsTileId)
          // Open the Run Inference accordion
          if (dataCabinetRef.value?.handleInferenceToggle) {
            dataCabinetRef.value.handleInferenceToggle(true)
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
            // Check if the polygon is within the grid extent and under size limit
            if (area > 500 || !isWithinExtent) {
              // If area exceeds 500 sq km or is outside grid, revert to the last valid state
              if (currentFeature) {
                // Create a new feature from the current valid state
                const validFeature = currentFeature.clone()
                drawVectorsource.clear()
                drawVectorsource.addFeature(validFeature)

                // Update the current feature reference
                currentFeature = validFeature

                // Show notification if area was too large
                if (area > 500) {
                  dataCabinetRef.value?.handleBboxSizeWarning(
                    'Bounding box area exceeds 500 square kilometers. Resizing to last valid state.',
                  )
                }
              } else {
                // If no valid state exists, reset to the initial bounding box
                const bboxExtent = calculateBoundingBox(currentGridExtent)
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
                if (area > 500) {
                  dataCabinetRef.value?.handleBboxSizeWarning(
                    'Bounding box area exceeds 500 square kilometers. Resetting to initial size.',
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

        function addInteractions() {
          snap = new Snap({
            source: drawVectorsource,
            pixelTolerance: 10,
            edge: true,
            vertex: true,
          })
          map.addInteraction(snap)
        }

        addInteractions()
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
