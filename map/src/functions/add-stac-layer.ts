import ImageLayer from 'ol/layer/Image';
import ImageStatic from 'ol/source/ImageStatic';
import { Map } from 'ol';
import { Extent } from 'ol/extent';
import { transformExtent } from 'ol/proj';

let currentStacLayer: ImageLayer<ImageStatic> | null = null;

export function addStacLayer(map: Map, imageUrl: string, extent: Extent) {
  console.log('Adding STAC layer:', { imageUrl, extent });

  // Remove existing STAC layer if it exists
  if (currentStacLayer) {
    console.log('Removing existing STAC layer');
    map.removeLayer(currentStacLayer);
  }

  try {
    // Transform extent from EPSG:4326 (WGS84) to EPSG:3857 (Web Mercator)
    const transformedExtent = transformExtent(extent, 'EPSG:4326', 'EPSG:3857');
    console.log('Transformed extent:', transformedExtent);

    // Create new STAC layer
    currentStacLayer = new ImageLayer({
      source: new ImageStatic({
        url: imageUrl,
        imageExtent: transformedExtent,
        crossOrigin: 'anonymous'
      }),
      zIndex: 100 // Place above base layer but below S2 grid
    });

    console.log('Created new STAC layer:', currentStacLayer);

    // Add the new layer to the map
    map.addLayer(currentStacLayer);
    console.log('Added layer to map');

    // Fit the view to the transformed extent
    map.getView().fit(transformedExtent, {
      duration: 1000,
      padding: [50, 50, 50, 50]
    });
    console.log('Fitted view to extent');
  } catch (error) {
    console.error('Error adding STAC layer:', error);
  }
}

export function removeStacLayer(map: Map) {
  if (currentStacLayer) {
    console.log('Removing STAC layer');
    map.removeLayer(currentStacLayer);
    currentStacLayer = null;
  }
}
