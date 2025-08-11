import ImageLayer from 'ol/layer/Image'
import ImageStatic from 'ol/source/ImageStatic'
import Map from 'ol/Map'
import type { Extent } from 'ol/extent'
import { shallowRef } from 'vue'

const currentStacLayer = shallowRef<ImageLayer<ImageStatic> | null>(null)
const currentSecondStacLayer = shallowRef<ImageLayer<ImageStatic> | null>(null)

export function addStacLayer(map: Map, imageUrl: string, extent: Extent) {
  try {
    // Create new STAC layer
    currentStacLayer.value = new ImageLayer({
      source: new ImageStatic({
        url: imageUrl,
        imageExtent: extent,
        crossOrigin: 'anonymous',
      }),
      extent: extent,
      zIndex: 100, // Place above base layer but below S2 grid
    })
    // Set a semi-transparent background to help distinguish the tile from the base layer
    currentStacLayer.value.setBackground('rgba(0, 0, 0, 0.4)')
    // Add the new layer to the map
    map.addLayer(currentStacLayer.value)
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
  const layer = isSecond ? currentSecondStacLayer : currentStacLayer
  if (!layer.value) {
    return
  }
  map.removeLayer(layer.value)
  layer.value = null
}

export function useStacLayer() {
  return {
    currentStacLayer,
    currentSecondStacLayer,
    addStacLayer,
    removeStacLayer,
  }
}
