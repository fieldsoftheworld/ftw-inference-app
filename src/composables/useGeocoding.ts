import { ref, watch } from 'vue'
import { debounce } from 'vuetify/lib/util/helpers.mjs'
import useAreaOfInterest from './useAreaOfInterest'
import useMap from './useMap'
import useNotifier from './useNotifier'
import { fromLonLat } from 'ol/proj'

const isLoadingPlaces = ref(false)
const placeSearch = ref('')
const suggestedPlaces = ref<Array<string>>([])

interface PlaceResult {
  lon: string
  lat: string
  display_name: string
}

export default function useGeocoding() {
  const { addBBoxAtPixel } = useAreaOfInterest()
  const { showError } = useNotifier()
  const { map, areaValues } = useMap()

  function handleLocationSelected(place: PlaceResult) {
    if (!map.value) return
    const lon = parseFloat(place.lon)
    const lat = parseFloat(place.lat)
    if (isNaN(lon) || isNaN(lat)) {
      showError('Invalid coordinates for the selected location provided by geocoding service.')
      return
    }
    const transformedCoord = fromLonLat([lon, lat])
    map.value.getView().setCenter(transformedCoord)
    const pixel = map.value?.getPixelFromCoordinate(transformedCoord)
    if (pixel) {
      addBBoxAtPixel(pixel, map.value, areaValues.value)
    }
  }

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
      } catch (error) {
        showError('Failed to fetch places. Please try again.')
      } finally {
        isLoadingPlaces.value = false
      }
    }, 500),
  )

  return {
    handleLocationSelected,
    placeSearch,
    isLoadingPlaces,
    suggestedPlaces,
  }
}
