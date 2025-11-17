import type { Polygon } from 'geojson'
import { type Ref, ref, shallowRef } from 'vue'
import searchStacApi, { type SearchSettings } from '../functions/search-stac-api'
import useNotifier from './useNotifier'

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

const searchResults = shallowRef<SearchResult[]>([])

const hasMore = ref(false)
const isLoading = ref(false)
// true = searching, false = error, number = number of results, null = not started
const searchStatus: Ref<number | null | boolean> = ref(null)

export default function useSearch() {
  const { showError } = useNotifier()

  // Function to handle search results
  async function handleSearchResults(
    bbox?: number[],
    settings: SearchSettings = {} as SearchSettings,
  ) {
    isLoading.value = true

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

  return {
    isLoading,
    searchStatus,
    searchResults,
    hasMore,
    handleSearchResults,
  }
}
