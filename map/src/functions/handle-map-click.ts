import { MapBrowserEvent, Map } from "ol";
import { Extent } from "ol/extent";
import searchStacApi from "./search-stac-api.ts";

export default function handleMapClick(event: MapBrowserEvent, map: Map) {
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

      // Update the sidebar with selected grid cell info
      const selectionInfo = document.getElementById('selection-info');
      if (selectionInfo) {
        selectionInfo.innerHTML = `<strong>Selected Grid Cell:</strong> ${mgrsTileId}`;
      }

      searchStacApi(mgrsTileId, true);
    }
  }
}