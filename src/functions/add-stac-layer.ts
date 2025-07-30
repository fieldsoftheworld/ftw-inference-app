import ImageLayer from 'ol/layer/Image'
import ImageStatic from 'ol/source/ImageStatic'
import { Map } from 'ol'
import type { Extent } from 'ol/extent'

let currentStacLayer: ImageLayer<ImageStatic> | null = null
let currentSecondStacLayer: ImageLayer<ImageStatic> | null = null

export function addStacLayer(map: Map, imageUrl: string, extent: Extent) {
  try {
    // Create new STAC layer
    currentStacLayer = new ImageLayer({
      source: new ImageStatic({
        url: imageUrl,
        imageExtent: extent,
        crossOrigin: 'anonymous',
      }),
      extent: extent,
      zIndex: 100, // Place above base layer but below S2 grid
    })
    // Set a semi-transparent background to help distinguish the tile from the base layer
    currentStacLayer.setBackground('rgba(0, 0, 0, 0.4)')
    // Add the new layer to the map
    map.addLayer(currentStacLayer)
    // Fit the view to the transformed extent
    map.getView().fit(extent, {
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
