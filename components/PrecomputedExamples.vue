<script setup lang="ts">
import { ref } from 'vue'
import { generateJWT } from '../functions/generate-jwt'
import type { Feature, Map } from 'ol'
import { fromLonLat } from 'ol/proj'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import type { Extent } from 'ol/extent'
import { Geometry } from 'ol/geom'

interface GeoJSONResponse {
  type: 'FeatureCollection'
  crs: {
    type: string
    properties: {
      name: string
    }
  }
  features: Array<{
    type: 'Feature'
    geometry: {
      type: string
      coordinates: number[][][]
    }
    properties: Record<string, unknown>
  }>
}

const props = defineProps<{
  isOpen: boolean
  map: Map
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
}>()

const isProcessing = ref(false)
const message = ref<{ type: 'success' | 'error' | 'loading'; text: string } | null>(null)
const vectorLayer = ref<VectorLayer<VectorSource> | null>(null)

const toggleAccordion = () => {
  emit('update:isOpen', !props.isOpen)
}

const fitMapToBbox = (bbox: number[]) => {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const extent: Extent = [
    fromLonLat([minLon, minLat])[0],
    fromLonLat([minLon, minLat])[1],
    fromLonLat([maxLon, maxLat])[0],
    fromLonLat([maxLon, maxLat])[1],
  ]
  // TODO: FIX ISSUE WITH SCROLLING AND CHANGE LAYER COLOR
  props.map.getView().fit(extent, {
    padding: [50, 50, 50, 50],
  })
}

const displayGeoJSON = (geojson: GeoJSONResponse) => {
  // Remove existing vector layer if it exists
  if (vectorLayer.value) {
    props.map.removeLayer(vectorLayer.value as VectorLayer<VectorSource>)
  }

  // Create new vector source and layer
  const source = new VectorSource({
    features: new GeoJSON({
      dataProjection: geojson.crs.properties.name,
      featureProjection: 'EPSG:3857',
    }).readFeatures(geojson),
  })

  const layer = new VectorLayer({
    source: source as VectorSource<Feature<Geometry>>,
    style: {
      'fill-color': 'rgba(0, 136, 136, 0.1)',
      'stroke-color': 'rgba(0, 136, 136, 1)',
      'stroke-width': 2,
    },
  })

  vectorLayer.value = layer
  props.map.addLayer(layer as VectorLayer<VectorSource>)
}

const handleExampleRequest = async () => {
  isProcessing.value = true
  message.value = { type: 'loading', text: 'Processing example...' }
  const apiBaseUrl = import.meta.env.PROD ? import.meta.env.VITE_API_BASE_URL : '/api'
  try {
    const token = generateJWT()
    const response = await fetch(`${apiBaseUrl}/example`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        inference: {
          model: '2_Class_FULL_FTW_Pretrained',
          images: [
            'https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2B_MSIL2A_20210617T100559_R022_T33UUP_20210624T063729',
            'https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2B_MSIL2A_20210925T101019_R022_T33UUP_20210926T121923',
          ],
          bbox: [13.0, 48.0, 13.05, 48.05],
        },
        polygons: {
          close_interiors: true,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to process example: ${response.statusText}`)
    }

    const data = await response.json()

    // Fit map to bbox
    fitMapToBbox([13.0, 48.0, 13.05, 48.05])

    // Display GeoJSON if available
    if (data && data.features) {
      displayGeoJSON(data)
    }

    message.value = { type: 'success', text: 'Example processed successfully' }
  } catch (error) {
    console.error('Error processing example:', error)
    message.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Failed to process example',
    }
  } finally {
    isProcessing.value = false
    // Clear message after 3 seconds
    setTimeout(() => {
      message.value = null
    }, 3000)
  }
}
</script>

<template>
  <div>
    <div class="accordion-header" @click="toggleAccordion">
      <h3>Precomputed Examples</h3>
      <span class="accordion-icon" :class="{ open: props.isOpen }">▼</span>
    </div>

    <transition name="accordion">
      <div v-show="props.isOpen" class="results">
        <div class="example-field">
          <div class="result-header">
            <h3>Precomputed Examples</h3>
          </div>
          <div class="result-details">
            <div v-if="message && !isProcessing" :class="['message', message.type]">
              {{ message.text }}
            </div>
            <button class="action-button" @click="handleExampleRequest" :disabled="isProcessing">
              <span v-if="isProcessing" class="progress-bar"></span>
              <span class="button-text">
                {{ isProcessing ? 'Processing...' : 'Run Example' }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: rgba(0, 136, 136, 0.2);
  border: 1px solid rgba(0, 136, 136, 0.8);
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 0.125rem;
}

.accordion-header h3 {
  margin: 0;
  font-size: 1rem;
  color: white;
}

.accordion-icon {
  color: white;
  transition: transform 0.3s ease;
  font-size: 0.75rem;
}

.accordion-icon.open {
  transform: rotate(180deg);
}

.results {
  flex: 5;
  overflow-y: auto;
  transition: opacity 0.3s ease;
}

.example-field {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.result-header h3 {
  margin: 0;
  font-size: 1rem;
  color: white;
  word-break: break-word;
}

.result-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.message {
  margin-bottom: 0.5rem;
  padding: 0.25rem;
  border-radius: 4px;
  font-size: 0.875rem;
  text-align: center;
}

.message.success {
  background-color: rgba(0, 255, 0, 0.1);
  border: 1px solid rgba(0, 255, 0, 0.3);
  color: #00ff00;
}

.message.error {
  background-color: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
  color: #ff0000;
}

.action-button {
  width: 100%;
  background-color: rgba(0, 136, 136, 0.8);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.25rem;
  position: relative;
  overflow: hidden;
}

.action-button:hover:not(:disabled) {
  background-color: rgba(0, 136, 136, 1);
}

.action-button:disabled {
  background-color: rgba(0, 136, 136, 0.4);
  cursor: not-allowed;
}

.button-text {
  position: relative;
  z-index: 1;
}

.progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background: linear-gradient(
    90deg,
    rgba(0, 136, 136, 0.2) 0%,
    rgba(0, 136, 136, 0.4) 50%,
    rgba(0, 136, 136, 0.2) 100%
  );
  animation: progress 1.5s ease-in-out infinite;
  transform: translateX(-100%);
}

@keyframes progress {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>
