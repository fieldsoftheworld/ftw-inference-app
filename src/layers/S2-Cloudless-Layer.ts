import TileLayer from 'ol/layer/Tile'
import { XYZ } from 'ol/source'

export default function createCloudlessLayer(year: number) {
  if (year < 2016) {
    year = 2016
  } else if (year > 2024) {
    year = 2024
  }
  return new TileLayer({
    source: new XYZ({
      url: `https://tiles.maps.eox.at/wmts?layer=s2cloudless${year === 2016 ? '' : '-' + year}_3857&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fjpeg&TileMatrix={z}&TileCol={x}&TileRow={y}`,
      maxZoom: 18,
      tileSize: 256,
      crossOrigin: 'anonymous',
      attributions:
        '<a href="https://s2maps.eu" target="_blank">Sentinel-2 cloudless - https://s2maps.eu</a> by <a href="https://eox.at" target="_blank">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2017 and later)',
    }),
  })
}
