import { Polygon } from 'geojson'
import { type Ref, ref } from 'vue'
import searchStacApi, { SearchSettings } from '../functions/search-stac-api'

export interface SearchResult {
  id: string
  date: string // Formatted date string
  isoDate: string // ISO date and time string
  cloudCover: number | string
  thumbnailUrl: string
  bounds: number[] | null
  tiffUrl: string // URL to the true color TIFF
  areaCoverage?: number | string
  geometry?: Polygon
  itemUrl?: string // URL to the STAC item
}

export type SearchResults = Ref<SearchResult[]>

export const searchResults = ref<SearchResult[]>([])
/** Grid extent, reduced by shrink factor (70% of grid extent) */
export const currentBbox = ref<number[] | undefined>(undefined)

const hasMore = ref(false)
const isLoading = ref(false)
// true = searching, false = error, number = number of results, null = not started
const searchStatus: Ref<number | null | boolean> = ref(null)

// Function to handle search results
export const handleSearchResults = async (
  bbox?: number[],
  settings: SearchSettings = {} as SearchSettings,
) => {
  isLoading.value = true

  currentBbox.value = bbox

  const performSearch = async () => {
    searchStatus.value = true
    try {
      const response = await searchStacApi(bbox, true, settings)
      if (response) {
        // Clear existing results for new search (resetSearch = true)
        searchResults.value = response.results
        hasMore.value = response.hasMore

        searchStatus.value = response.results.length
      }
    } catch (error: unknown) {
      searchStatus.value = false
      console.error('DataCabinet: Error searching:', error)
      showError(`Error searching: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      isLoading.value = false
    }
  }
  await performSearch()
}

export const clearSearchResults = () => {
  searchResults.value = []
  hasMore.value = false
  isLoading.value = false
  searchStatus.value = null
  currentBbox.value = undefined
}

export function useSearch() {
  return {
    isLoading,
    searchStatus,
    currentBbox,
    searchResults,
    hasMore,
    handleSearchResults,
    clearSearchResults,
  }
}
