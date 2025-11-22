import Map from 'ol/Map'
import type { Extent } from 'ol/extent'
import { shallowRef } from 'vue'
import { ImageTile } from 'ol/source'
import TileLayer from 'ol/layer/Tile'

const currentStacLayer = shallowRef<TileLayer<ImageTile> | null>(null)
const currentSecondStacLayer = shallowRef<TileLayer<ImageTile> | null>(null)

export default function useStacLayer() {
  function addStacLayer(map: Map, imageUrl: string, extent: Extent) {
    try {
      // Create new STAC layer
      currentStacLayer.value = new TileLayer({
        source: new ImageTile({
          url: 'https://tiles.rdnt.io/tiles/{z}/{x}/{y}?url=' + encodeURIComponent(imageUrl),
          crossOrigin: 'anonymous',
          maxZoom: 18,
        }),
        extent,
        // Set a semi-transparent background to help distinguish the tile from the base layer
        background: 'rgba(0, 0, 0, 0.7)',
        zIndex: 100, // Place above base layer but below S2 grid
      })
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

  function removeStacLayer(map: Map, isSecond: boolean = false) {
    const layer = isSecond ? currentSecondStacLayer : currentStacLayer
    if (!layer.value) {
      return
    }
    map.removeLayer(layer.value)
    layer.value = null
  }

  return {
    currentStacLayer,
    currentSecondStacLayer,
    addStacLayer,
    removeStacLayer,
  }
}
