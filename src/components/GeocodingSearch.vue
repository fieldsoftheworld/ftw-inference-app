<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { debounce } from 'vuetify/lib/util/helpers.mjs'
import type { PlaceResult } from '../composables/useAreaOfInterest'

const emit = defineEmits<{
  (e: 'location-selected', place: PlaceResult): void
}>()

const isLoadingPlaces = ref(false)
const placeSearch = ref('')
const suggestedPlaces = shallowRef<{ value: PlaceResult; title: string }[]>([])

watch(
  placeSearch,
  debounce(async (newSearch: string) => {
    if (newSearch.length < 3) return

    isLoadingPlaces.value = true
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newSearch)}`,
      )
      const data = await response.json()
      suggestedPlaces.value = data?.map((place: any) => ({
        value: place,
        title: place.display_name,
      }))
    } catch {
      console.error('Failed to fetch places.')
    } finally {
      isLoadingPlaces.value = false
    }
  }, 500),
)

const onLocationSelected = (item: { value: PlaceResult; title: string } | null) => {
  if (item) {
    emit('location-selected', item.value)
  }
}
</script>

<template>
  <v-autocomplete
    @update:model-value="onLocationSelected"
    v-model:search="placeSearch"
    :loading="isLoadingPlaces"
    :items="suggestedPlaces"
    label="Search for a place"
    item-title="title"
    return-object
    hide-details
    dense
    variant="outlined"
  ></v-autocomplete>
</template>
