import type { Polygon } from 'geojson'
import type { SearchResult } from '../composables/useSearch'
import useSettings from '../composables/useSettings'

const { defaultSettings } = useSettings()

// Store the currently selected feature
let nextPageToken: string | null = null
let totalResultsReturned: number = 0
let totalNumberMatched: number = 0

interface SearchResponse {
  results: SearchResult[]
  hasMore: boolean
  totalFound: number
  numberMatched: number
  numberReturned: number
}

interface StacFeature {
  id: string
  links: { rel: string; type: string; href: string }[]
  properties: {
    datetime: string
    'eo:cloud_cover': number
    's2:vegetation_percentage': number
    's2:water_percentage': number
    's2:not_vegetated_percentage': number
    's2:unclassified_percentage': number
    's2:nodata_pixel_percentage': number
  }
  geometry?: Polygon
  assets?: {
    thumbnail?: {
      href: string
    }
    visual?: {
      href: string
    }
    blue?: {
      href: string
    }
    red?: {
      href: string
    }
    green?: {
      href: string
    }
  }
  bbox?: number[]
}

interface StacResponse {
  numberReturned: any
  numberMatched: any
  features: StacFeature[]
  links?: Array<{
    body: any
    rel: string
    href: string
  }>
}

export interface SearchSettings {
  startMonth: number
  endMonth: number
  year: number
  cloudCover: number
  areaCoverage: number
  buffer: number
  autoSceneSelection?: boolean
}

export const tileDataFromStacFeature = (item: StacFeature): SearchResult => {
  // Calculate area coverage as 100 - nodata_pixel_percentage
  const nodataPercentage = item.properties['s2:nodata_pixel_percentage'] || 0
  const areaCoverage = 100 - nodataPercentage

  const result = {
    id: item.id,
    date: new Date(item.properties.datetime).toLocaleDateString(),
    isoDate: item.properties.datetime,
    cloudCover: item.properties['eo:cloud_cover'],
    areaCoverage,
    thumbnailUrl: item.assets?.thumbnail?.href || item.assets?.visual?.href || '#',
    tiffUrl: item.assets?.visual?.href || '#',
    bounds: item.bbox
      ? item.bbox.length === 6
        ? [item.bbox[0], item.bbox[1], item.bbox[3], item.bbox[4]]
        : item.bbox
      : null,
    geometry: item.geometry,
    itemUrl: item.links.find((link) => link.rel === 'self')?.href,
  }
  return result
}

export function getHemisphere(utmTile: string | null): 'N' | 'S' | 'E' | null {
  if (typeof utmTile !== 'string' || utmTile.length !== 5) {
    return null
  }

  const latitudeBand = utmTile.charAt(2).toUpperCase()
  const southern = 'CDEFGHJ'
  const equatorial = 'KLMNPQ'
  const northern = 'RSTUVWXY'

  if (northern.includes(latitudeBand)) return 'N'
  else if (southern.includes(latitudeBand)) return 'S'
  else if (equatorial.includes(latitudeBand)) return 'E'
  else return null
}

// Function to search the STAC API
export default async function searchStacApi(
  utmTileId: string | null,
  bbox?: number[],
  resetSearch = true,
  params?: SearchSettings,
): Promise<SearchResponse | undefined> {
  // Reset counters for new search
  if (resetSearch) {
    totalResultsReturned = 0
    totalNumberMatched = 0
  }

  const startYear = params?.year || defaultSettings.year
  let endYear = startYear

  let startMonth: number, endMonth: number
  const hemisphere = getHemisphere(utmTileId)
  if (params?.autoSceneSelection || !params?.startMonth || !params?.endMonth) {
    if (hemisphere === 'E') {
      // Equatorial: January this year to June next year
      startMonth = 1
      endMonth = 6
      endYear += 1
    } else if (hemisphere === 'S') {
      // Southern Hemisphere: July this year to July next year
      startMonth = 7
      endMonth = 7
      endYear += 1
    } else {
      // Northern Hemisphere (or unknown): January to December same year
      startMonth = 1
      endMonth = 12
    }
  } else {
    startMonth = params.startMonth
    endMonth = params.endMonth
    if (endMonth < startMonth) {
      endYear += 1
    }
  }

  const startMonthStr = String(startMonth).padStart(2, '0')
  const endMonthStr = String(endMonth).padStart(2, '0')
  const startDate = `${startYear}-${startMonthStr}-01T00:00:00Z`
  const lastDayOfMonth = new Date(endYear, endMonth % 12, 0).getDate()
  const endDate = `${endYear}-${endMonthStr}-${lastDayOfMonth}T23:59:59Z`
  const cloudCover = params?.cloudCover || defaultSettings.cloudCover
  const areaCoverage = params?.areaCoverage || defaultSettings.areaCoverage

  try {
    // Build request body for POST
    const requestBody: any = {
      collections: ['sentinel-2-c1-l2a'],
      limit: 100,
      query: {
        ['eo:cloud_cover']: {
          lte: cloudCover,
        },
        ['s2:nodata_pixel_percentage']: {
          lte: 100 - areaCoverage,
        },
      },
    }

    // Add datetime filter if dates are provided
    if (startDate && endDate) {
      requestBody.datetime = `${startDate}/${endDate}`
    } else if (startDate) {
      requestBody.datetime = `${startDate}/..`
    } else if (endDate) {
      requestBody.datetime = `../${endDate}`
    }

    // Add bbox parameter if provided
    if (bbox && bbox.length === 4) {
      requestBody.bbox = bbox
    }

    // Add the pagination token if we're loading more results
    if (!resetSearch && nextPageToken) {
      requestBody.next = nextPageToken
    }

    // Make the POST request
    const response = await fetch('https://earth-search.aws.element84.com/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/geo+json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as StacResponse

    // Update totals from the response
    totalNumberMatched = data.numberMatched || 0
    totalResultsReturned += data.numberReturned || data.features.length

    // Look for the "next" link which contains the pagination token
    let nextLink = null
    if (data.links) {
      nextLink = data.links.find((link) => link.rel === 'next')
    }

    // Store the pagination token if available
    if (nextLink && nextLink.body) {
      // Extract token from the URL - Earth Search uses 'next' parameter
      if (nextLink.body.next) {
        nextPageToken = decodeURIComponent(nextLink.body.next)
      } else {
        nextPageToken = null
      }
    } else {
      nextPageToken = null
    }

    // Process and sort the results
    const results = data.features
      .sort((a: StacFeature, b: StacFeature) => {
        // First sort by date (newest first)
        const dateComparison =
          new Date(b.properties.datetime).getTime() - new Date(a.properties.datetime).getTime()
        if (dateComparison !== 0) return dateComparison

        // If dates are equal, sort by cloud cover (lowest first)
        const aCloudCover =
          typeof a.properties['eo:cloud_cover'] === 'number'
            ? a.properties['eo:cloud_cover']
            : Infinity
        const bCloudCover =
          typeof b.properties['eo:cloud_cover'] === 'number'
            ? b.properties['eo:cloud_cover']
            : Infinity
        return aCloudCover - bCloudCover
      })
      .map(tileDataFromStacFeature)

    // Calculate hasMore based on whether we've returned all available results
    const hasMoreResults = totalResultsReturned < totalNumberMatched

    return {
      results,
      hasMore: hasMoreResults,
      totalFound: data.features.length,
      numberMatched: totalNumberMatched,
      numberReturned: totalResultsReturned,
    }
  } catch (error) {
    console.error('Error searching Earth Search API:', error)
    throw error // Re-throw the error to be handled by the caller
  }
}
