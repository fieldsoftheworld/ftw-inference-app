import { MapBrowserEvent, Map } from "ol";
import { Extent } from "ol/extent";
import DataCabinet from "../components/DataCabinet.vue";
import type { Ref } from "vue";

export default function handleMapClick(event: MapBrowserEvent, map: Map, dataCabinetRef: Ref<InstanceType<typeof DataCabinet> | null>) {
  const feature = map.forEachFeatureAtPixel(event.pixel, (feature) => feature);

  if (feature) {
    // Get the MGRS Tile ID from the feature properties
    const mgrsTileId = feature.get('Name') || '37PDN';

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
        dataCabinetRef.value.handleSearchResults(mgrsTileId);
      } else {
        console.error('S2 Grid Layer: DataCabinet ref not available');
      }
    }
  }
}