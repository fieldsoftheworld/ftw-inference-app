import GeoJSON from 'ol/format/GeoJSON.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import JSZip from 'jszip';

export default async function createS2GridLayer(map) {

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
      const geoJsonFile = zipContents.files[fileNames.find(name => name.endsWith('.geojson'))];
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
            color: 'rgba(0, 136, 136, 0.8)',  // Green color
            width: 0.5,
          }),
          fill: new Fill({
            color: 'rgba(0, 136, 136, 0.8)'  // Very light green fill with transparency
          })
        })
      });

      map.addLayer(vectorLayer);
      console.log(vectorLayer);

    } catch (error) {
      console.error("Error loading S2 grid data:", error);
      setTimeout(() => {
      }, 3000);
    }
}