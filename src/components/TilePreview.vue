<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import useAreaOfInterest from '../composables/useAreaOfInterest'
import useNotifier from '../composables/useNotifier'
import type { SearchResult } from '../composables/useSearch'
import useStacLayer from '../composables/useStacLayer'

const { activeTileId, secondActiveTileId, currentGridExtent, getTileById } = useAreaOfInterest()
const { showWarning } = useNotifier()
const { stacPreviewTileId } = useStacLayer()

const props = defineProps<{
  tileId: string
  win: 'a' | 'b'
}>()

const tile = ref<SearchResult | null>(null)

const active = computed(() => {
  return props.win === 'a'
    ? props.tileId === activeTileId.value
    : props.tileId === secondActiveTileId.value
})

watch(
  () => props.tileId,
  async (newTileId) => {
    tile.value = await getTileById(newTileId)
  },
  { immediate: true },
)

const handleViewOnMap = async () => {
  const selectedTile = tile.value
  if (!selectedTile) {
    return
  }
  const bounds = selectedTile.bounds
  const tileId = props.tileId
  stacPreviewTileId.value = tileId
  const isSecondAccordion = props.win === 'b'
  // Use the stored currentGridExtent for positioning the STAC layer
  const gridExtent = currentGridExtent.value || bounds

  // Check area coverage and show warning if less than 100%
  if (selectedTile && selectedTile.areaCoverage !== undefined) {
    const areaCoverage =
      typeof selectedTile.areaCoverage === 'number'
        ? selectedTile.areaCoverage
        : parseFloat(selectedTile.areaCoverage as string)

    if (!isNaN(areaCoverage) && areaCoverage <= 99.9) {
      showWarning(
        `Selected tile has only ${areaCoverage.toFixed(
          1,
        )}% area coverage. Be sure to select an area where there is imagery coverage.`,
      )
    }
  }

  if (isSecondAccordion) {
    if (tileId === activeTileId.value) {
      return
    }

    if (secondActiveTileId.value === tileId) {
      secondActiveTileId.value = null
    } else {
      if (gridExtent) {
        secondActiveTileId.value = tileId
      } else {
        console.error('No bounds available for this image')
      }
    }
  } else {
    if (activeTileId.value === tileId) {
      activeTileId.value = null
      if (secondActiveTileId.value === tileId) {
        secondActiveTileId.value = null
      }
    } else {
      if (gridExtent) {
        activeTileId.value = tileId
        if (secondActiveTileId.value === tileId) {
          secondActiveTileId.value = null
        }
      } else {
        console.error('No bounds available for this image')
      }
    }
  }
}
</script>

<template>
  <div v-if="tile" :id="props.tileId" class="result-item" :class="{ active: active }">
    <div class="result-thumbnail" @click="handleViewOnMap">
      <img :src="tile.thumbnailUrl" alt="Preview" />
    </div>
    <div class="result-header">
      <h3>{{ props.tileId }}</h3>
    </div>
    <div class="result-details">
      <div title="Sentinel-2 acquisition date.">Date: {{ tile.date }}</div>
      <div
        v-if="typeof tile.cloudCover === 'number'"
        title="Percent of the scene obscured by clouds."
      >
        Cloud Cover: {{ tile.cloudCover.toFixed(1) }}%
      </div>
      <div
        v-if="typeof tile.areaCoverage === 'number'"
        title="Percent of your AOI covered by this scene."
      >
        Area Coverage: {{ tile.areaCoverage.toFixed(1) }}%
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-item {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  margin-top: 0.5rem;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.result-item:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.result-item.active {
  background-color: rgba(0, 136, 136, 0.2);
  border-color: rgba(0, 136, 136, 0.8);
  box-shadow: 0 0 10px rgba(0, 136, 136, 0.4);
}

.result-item.disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.result-item.disabled .result-thumbnail {
  cursor: not-allowed;
}

.result-thumbnail {
  width: 100%;
  height: 200px;
  overflow: hidden;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-thumbnail:hover {
  transform: scale(1.02);
}

.result-thumbnail.active {
  border-color: rgba(0, 136, 136, 0.8);
  box-shadow: 0 0 10px rgba(0, 136, 136, 0.4);
}

.result-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.result-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
</style>
