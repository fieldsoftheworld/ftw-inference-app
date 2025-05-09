import GeoJSON from 'ol/format/GeoJSON.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import s2GridData from '../data/s2-grid.json';

export default function createS2GridLayer() {
    return new VectorLayer({
      source: new VectorSource({
        features: new GeoJSON({
          dataProjection: 'urn:ogc:def:crs:OGC:1.3:CRS84',
          featureProjection: 'EPSG:3857'
        }).readFeatures(s2GridData),
      }),
      zIndex: 1000,
      style: new Style({
        stroke: new Stroke({
          color: 'rgba(0, 136, 136, 1)',  // Green color
          width: 1,
        }),
        fill: new Fill({
          color: 'rgba(0, 136, 136, 0.1)'  // Very light green fill with transparency
        })
      })
    });
}