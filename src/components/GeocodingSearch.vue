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

// Set loading immediately so the indicator appears before the debounce delay
watch(placeSearch, (newSearch) => {
  if (suggestedPlaces.value.some((p) => p.title === newSearch)) return
  if (newSearch.length >= 3) {
    isLoadingPlaces.value = true
  } else {
    isLoadingPlaces.value = false
    suggestedPlaces.value = []
  }
})

watch(
  placeSearch,
  debounce(async (newSearch: string) => {
    if (suggestedPlaces.value.some((p) => p.title === newSearch) || newSearch.length < 3) return

    try {
      const referer = 'https://github.com/fieldsoftheworld/ftw-inference-app'
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newSearch)}`,
        // User-Agent or Referer are required by Nominatim's usage policy.
        // User-Agent is not working in Chrome, thus sending both.
        // Referer is usually set by the browser, but let's ensure it's set.
        {
          headers: {
            'User-Agent': referer,
            Referer: referer,
          },
        },
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
    <v-menu open-on-hover :close-on-content-click="false" max-width="400">
      <template #activator="{ props }">
        <v-icon class="ml-1" :icon="mdiHelpCircleOutline" size="x-small" v-bind="props"></v-icon>
      </template>
      <v-sheet class="pa-3 text-body-2">
        Geocoding provided by Nominatim.<br />
        &copy; OpenStreetMap,
        <a href="https://openstreetmap.org" target="_blank" rel="noopener">openstreetmap.org</a
        ><br />
        License: ODbL
      </v-sheet>
    </v-menu>
  </div>
</template>
