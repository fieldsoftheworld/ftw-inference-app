import ImageLayer from 'ol/layer/Image'
import ImageStatic from 'ol/source/ImageStatic'
import { Map } from 'ol'
import { Extent } from 'ol/extent'
import { transformExtent } from 'ol/proj'

let currentStacLayer: ImageLayer<ImageStatic> | null = null
let currentSecondStacLayer: ImageLayer<ImageStatic> | null = null

export function addStacLayer(map: Map, imageUrl: string, extent: Extent) {
  try {
    // Transform extent from EPSG:4326 (WGS84) to EPSG:3857 (Web Mercator)
    const transformedExtent = transformExtent(extent, 'EPSG:4326', 'EPSG:3857')
    // Create new STAC layer
    currentStacLayer = new ImageLayer({
      source: new ImageStatic({
        url: imageUrl,
        imageExtent: transformedExtent,
        crossOrigin: 'anonymous',
      }),
      zIndex: 100, // Place above base layer but below S2 grid
    })
    // Add the new layer to the map
    map.addLayer(currentStacLayer)
    // Fit the view to the transformed extent
    map.getView().fit(transformedExtent, {
      duration: 1000,
      padding: [50, 50, 50, 50],
    })
  } catch (error) {
    console.error('Error adding STAC layer:', error)
  }
}

export function removeStacLayer(map: Map, isSecond: boolean = false) {
  const layerToRemove = isSecond ? currentSecondStacLayer : currentStacLayer
  const newLayersArray = map
    .getLayers()
    .getArray()
    .filter(
      ({ ol_uid }: any) =>
        ol_uid !== (isSecond ? currentSecondStacLayer : (currentStacLayer as any))?.ol_uid,
    )
  if (layerToRemove) {
    map.setLayers(newLayersArray)
    if (isSecond) {
      currentSecondStacLayer = null
    } else {
      currentStacLayer = null
    }
  }
}
