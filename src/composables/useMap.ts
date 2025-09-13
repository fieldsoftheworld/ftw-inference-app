import type Map from 'ol/Map'
import { ref, shallowRef } from 'vue'

export const map = shallowRef<Map | null>(null)
export const areaValues = ref<{ min_area_km2: number; max_area_km2: number } | null>(null)

export function useMap() {
  return {
    map,
    areaValues,
  }
}
