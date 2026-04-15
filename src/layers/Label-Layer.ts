import type { FeatureLike } from 'ol/Feature'
import VectorTileLayer from 'ol/layer/VectorTile'
import { applyStyle } from 'ol-mapbox-style'

const POSITRON_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

// Only render administrative boundaries and place/water/road labels
// (no background, fills, or road geometry — keeps the layer transparent)
const LABEL_AND_BOUNDARY_LAYERS = [
  'boundary_county',
  'boundary_state',
  'boundary_country_outline',
  'boundary_country_inner',
  'waterway_label',
  'watername_ocean',
  'watername_sea',
  'watername_lake',
  'watername_lake_line',
  'place_hamlet',
  'place_suburbs',
  'place_villages',
  'place_town',
  'place_country_2',
  'place_country_1',
  'place_state',
  'place_continent',
  'place_city_r6',
  'place_city_r5',
  'place_city_dot_r7',
  'place_city_dot_r4',
  'place_city_dot_r2',
  'place_city_dot_z7',
  'place_capital_dot_z7',
  'roadname_minor',
  'roadname_sec',
  'roadname_pri',
  'roadname_major',
]

export default function createLabelLayer() {
  const layer = new VectorTileLayer({ declutter: true })

  applyStyle(layer, POSITRON_STYLE_URL, { layers: LABEL_AND_BOUNDARY_LAYERS }).then(() => {
    const originalStyleFn = layer.getStyleFunction()!
    layer.setStyle((feature: FeatureLike, resolution: number) => {
      const styles = originalStyleFn(feature, resolution)
      if (!styles) return styles
      const arr = Array.isArray(styles) ? styles : [styles]
      for (const style of arr) {
        const text = style.getText()
        if (text) {
          text.getFill()?.setColor('#ffffff')
          text.getStroke()?.setColor('#333333')
        }
      }
      return arr
    })
  })

  return layer
}
