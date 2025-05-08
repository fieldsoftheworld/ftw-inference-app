import GeoJSON from 'ol/format/GeoJSON.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import JSZip from 'jszip';
import { Map } from 'ol';
export default async function createS2GridLayer(map: Map) {

    try {
      // Fetch the zipped GeoJSON file
      const response = await fetch('https://data.source.coop/cholmes/s2-grid/s2-grid.geojson.zip');
      const zipBlob = await response.blob();
      // Use JSZip to unzip the file
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(zipBlob);
      // Find the first file in the zip (should be the .geojson)
      const fileNames = Object.keys(zipContents.files);
      if (fileNames.length === 0) {
          throw new Error('No files found in the zip archive');
      }
      // Get the GeoJSON content
      const geoJsonFile = zipContents.files[fileNames.find(name => name.endsWith('.geojson')) as string];
      if (!geoJsonFile) {
          throw new Error('No GeoJSON file found in the zip archive');
      }
      const geoJsonText = await geoJsonFile.async('text');
      const geoJson = JSON.parse(geoJsonText);
      const vectorSource = new VectorSource({
        features: new GeoJSON().readFeatures(geoJson),
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