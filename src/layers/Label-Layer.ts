import TileLayer from 'ol/layer/Tile'
import { XYZ } from 'ol/source'

export default function createLabelLayer() {
  return new TileLayer({
    source: new XYZ({
      url: 'https://{a-d}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
      maxZoom: 20,
      minZoom: 0,
      crossOrigin: 'anonymous',
      attributions: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }),
  })
}
