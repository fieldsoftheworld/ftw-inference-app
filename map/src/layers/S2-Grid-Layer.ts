import GeoJSON from 'ol/format/GeoJSON.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import { Map } from 'ol';
import s2GridData from '../data/s2-grid.json';
export default async function createS2GridLayer(map: Map) {

    try {
      const vectorSource = new VectorSource({
        features: new GeoJSON().readFeatures(s2GridData),
      });

      const vectorLayer = new VectorLayer({
        source: vectorSource,
        style: new Style({
          stroke: new Stroke({
            color: 'rgba(0, 136, 136, 1)',  // Green color
            width: 30,
          }),
          fill: new Fill({
            color: 'rgba(0, 136, 136, 0.8)'  // Very light green fill with transparency
          })
        })
      });

      map.addLayer(vectorLayer);
    } catch (error) {
      console.error("Error loading S2 grid data:", error);
      setTimeout(() => {
      }, 3000);
    }
}