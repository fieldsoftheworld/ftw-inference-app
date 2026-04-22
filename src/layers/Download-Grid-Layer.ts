import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { Fill, Stroke, Style } from 'ol/style'
import type { FeatureLike } from 'ol/Feature'

export const DOWNLOAD_GRID_URL =
  'https://data.source.coop/ftw/global-field-boundaries/download-tiles/ftw-download-grid.geojson'

export const getDownloadParquetUrl = (year: number, tileId: string) =>
  `https://data.source.coop/ftw/global-field-boundaries/download-tiles/geoparquet/${year}/${tileId}.parquet`

const normalStyle = new Style({
  fill: new Fill({ color: 'rgba(0, 136, 136, 0.05)' }),
  stroke: new Stroke({ color: 'rgba(0, 136, 136, 0.6)', width: 1 }),
})

const hoverStyle = new Style({
  fill: new Fill({ color: 'rgba(0, 136, 136, 0.15)' }),
  stroke: new Stroke({ color: 'rgba(0, 200, 200, 0.9)', width: 1.5 }),
})

export function getDownloadGridStyle(
  feature: FeatureLike,
  hoveredFeature: FeatureLike | null,
): Style {
  if (feature === hoveredFeature) return hoverStyle
  return normalStyle
}

export function createDownloadGridLayer(hoveredFeatureRef: {
  value: FeatureLike | null
}): VectorLayer<VectorSource> {
  const source = new VectorSource({
    url: DOWNLOAD_GRID_URL,
    format: new GeoJSON(),
  })

  return new VectorLayer({
    source,
    style: (feature) => getDownloadGridStyle(feature, hoveredFeatureRef.value),
    zIndex: 500,
    properties: { name: 'download-grid' },
  })
}
