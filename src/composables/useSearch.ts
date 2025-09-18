import { Polygon } from 'geojson'
import { type Ref, ref, watch } from 'vue'
import searchStacApi, { SearchSettings } from '../functions/search-stac-api'

export interface SearchResult {
  id: string
  date: string
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

const collections = {
  'sentinel-2-c1-l2a': 'Sentinel-2 Level 2A, Collection 1',
  'sentinel-2-l2a': 'Sentinel-2 Level 2A, Legacy'
}
const availableCollections = Object.keys(collections).map(c => [c]);

const hasMore = ref(false)
const isLoading = ref(false)
const searchStatus = ref('')
/** Grid extent, reduced by shrink factor (70% of grid extent) */
const currentBbox = ref<number[] | undefined>(undefined)
const selectedCollection = ref<string[]>(availableCollections[0])

let unwatch: () => void

// Function to handle search results
export const handleSearchResults = async (
  mgrsTileId: string,
  bbox?: number[],
  settings: SearchSettings = {} as SearchSettings,
) => {
  isLoading.value = true
  searchStatus.value = `Searching for Sentinel-2 images in tile ${mgrsTileId}...`

  currentBbox.value = bbox

  const performSearch = async () => {
    settings.collections = selectedCollection.value
    try {
      const response = await searchStacApi(bbox, true, settings)
      if (response) {
        // Clear existing results for new search (resetSearch = true)
        searchResults.value = response.results
        hasMore.value = response.hasMore

        if (response.results.length === 0) {
          searchStatus.value = `No images found. Try adjusting your filters (date range, cloud cover, area coverage) to increase the likelihood of finding results.`
        } else {
          searchStatus.value = `Found ${response.results.length} images`
        }
      }
    } catch (error: unknown) {
      console.error('DataCabinet: Error searching:', error)
      searchStatus.value = `Error searching: ${error instanceof Error ? error.message : 'Unknown error'}`
    } finally {
      isLoading.value = false
    }
  }
  await performSearch()

  if (unwatch) {
    unwatch()
  }
  unwatch = watch(selectedCollection, performSearch)
}

export const clearSearchResults = () => {
  searchResults.value = []
  hasMore.value = false
  isLoading.value = false
  searchStatus.value = ''
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
    availableCollections,
    selectedCollection,
    collections,
  }
}
