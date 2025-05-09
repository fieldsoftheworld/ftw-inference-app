import GeoJSON from 'ol/format/GeoJSON.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import s2GridData from '../data/s2-grid.json';
import { Map } from 'ol';
import { Extent } from 'ol/extent';
import type { Ref } from 'vue';
import type DataCabinet from '../components/DataCabinet.vue';

export default function createS2GridLayer(
  map: Map,
  dataCabinetRef: Ref<InstanceType<typeof DataCabinet> | null>
) {
    const layer = new VectorLayer({
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

    // Add click handler
    map?.on('click', (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (feature) => feature);

      if (feature) {
        // Get the MGRS Tile ID from the feature properties
        const mgrsTileId = feature.get('Name') || '37PDN';
        console.log("S2 Grid Layer: Found MGRS Tile ID:", mgrsTileId, "from property 'Name'");

        // Get the feature's extent
        const geometry = feature.getGeometry();
        if (geometry) {
          const extent = geometry.getExtent();

          // Add padding to the extent
          const padding = 50;
          const paddedExtent: Extent = [
            extent[0] - padding,
            extent[1] - padding,
            extent[2] + padding,
            extent[3] + padding
          ];

          // Fit the view to the extent
          map.getView().fit(paddedExtent, {
            duration: 1000,
            maxZoom: 13
          });

          // Call the search function through the ref
          if (dataCabinetRef.value?.handleSearchResults) {
            console.log('S2 Grid Layer: Calling handleSearchResults with', mgrsTileId);
            dataCabinetRef.value.handleSearchResults(mgrsTileId);
          } else {
            console.error('S2 Grid Layer: DataCabinet ref not available');
          }
        }
      }
    });

    return layer;
}
