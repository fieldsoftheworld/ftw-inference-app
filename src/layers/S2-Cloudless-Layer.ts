import TileLayer from 'ol/layer/Tile'
import { XYZ } from 'ol/source'

export default function createCloudlessLayer(year: number) {
  return new TileLayer({
    source: new XYZ({
      url: `https://tiles.maps.eox.at/wmts?layer=s2cloudless${year === 2016 ? '' : '-' + year}_3857&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fjpeg&TileMatrix={z}&TileCol={x}&TileRow={y}`,
      maxZoom: 18,
      tileSize: 256,
      crossOrigin: 'anonymous',
      attributions: 'Sentinel-2 cloudless imagery by <a href="https://eox.at">EOX</a>',
    }),
  })
}
