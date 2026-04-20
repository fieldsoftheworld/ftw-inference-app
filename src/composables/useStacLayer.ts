import { shallowRef, watch } from 'vue'
import { ImageTile } from 'ol/source'
import TileLayer from 'ol/layer/Tile'
import { map } from './useMap'
import { getTileById, activeTileId, secondActiveTileId } from './useAreaOfInterest'
import { transformExtent } from 'ol/proj'
import useSettings from './useSettings'

let currentStacLayer: TileLayer<ImageTile> | null = null
const stacPreviewTileId = shallowRef<string | null>(null)
/** Stores the preview tile id while in global mode so it can be restored */
let savedPreviewTileId: string | null = null

async function addStacLayer() {
  if (!map.value || !stacPreviewTileId.value) {
    return
  }
  const tile = await getTileById(stacPreviewTileId.value)
  if (!tile) {
    return
  }
  const imageUrl = tile.tiffUrl
  const extent = tile.bounds ? transformExtent(tile.bounds, 'EPSG:4326', 'EPSG:3857') : undefined
  if (!imageUrl) {
    return
  }
  // Create new STAC layer
  currentStacLayer = new TileLayer({
    source: new ImageTile({
      url: 'https://tiles.rdnt.io/tiles/{z}/{x}/{y}?url=' + encodeURIComponent(imageUrl),
      crossOrigin: 'anonymous',
      maxZoom: 18,
    }),
    extent: extent,
    zIndex: 100, // Place above base layer but below S2 grid
    // Set a semi-transparent background to help distinguish the tile from the base layer
    background: 'rgba(0, 0, 0, 0.7)',
  })
  // Add the new layer to the map
  map.value.addLayer(currentStacLayer)
}

function removeStacLayer() {
  if (!currentStacLayer) {
    return
  }
  map.value?.removeLayer(currentStacLayer)
  currentStacLayer = null
}

watch(stacPreviewTileId, async (newTileId) => {
  removeStacLayer()
  if (newTileId) {
    await addStacLayer()
  }
})

watch(
  [activeTileId, secondActiveTileId],
  () => {
    watch(activeTileId, (newActiveTileId, oldActiveTileId) => {
      if (stacPreviewTileId.value === oldActiveTileId) {
        stacPreviewTileId.value = newActiveTileId
      }
    })
    watch(secondActiveTileId, (newSecondActiveTileId, oldSecondActiveTileId) => {
      if (stacPreviewTileId.value === oldSecondActiveTileId) {
        stacPreviewTileId.value = newSecondActiveTileId
      }
    })
  },
  { once: true },
)

const { settings } = useSettings()
watch(
  () => settings.value.mode,
  (mode) => {
    if (mode === 'global') {
      savedPreviewTileId = stacPreviewTileId.value
      stacPreviewTileId.value = null
    } else {
      if (savedPreviewTileId) {
        stacPreviewTileId.value = savedPreviewTileId
        savedPreviewTileId = null
      }
    }
  },
)

export default function useStacLayer() {
  return {
    stacPreviewTileId,
  }
}
