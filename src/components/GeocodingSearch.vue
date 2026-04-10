<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { debounce } from 'vuetify/lib/util/helpers.mjs'
import type { PlaceResult } from '../composables/useAreaOfInterest'
import { mdiHelpCircleOutline } from '@mdi/js'

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
        { headers: { 'User-Agent': 'https://github.com/fieldsoftheworld/ftw-inference-app' } },
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
  }, 1000),
)

const onLocationSelected = (item: { value: PlaceResult; title: string } | null) => {
  if (item) {
    emit('location-selected', item.value)
  }
}
</script>

<template>
  <div class="d-flex align-center mb-2 ga-2">
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
    <v-tooltip max-width="400" open-on-click>
      <template #activator="{ props }">
        <v-icon class="ml-1" :icon="mdiHelpCircleOutline" size="x-small" v-bind="props"></v-icon>
      </template>
      Geocoding provided by Nominatim.<br />
      &copy; OpenStreetMap, https://openstreetmap.org<br />
      License: ODbL
    </v-tooltip>
  </div>
</template>
