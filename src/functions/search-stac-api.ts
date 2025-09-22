import { Polygon } from 'geojson'
import { SearchResult } from '../composables/useSearch'

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
  startDate: string
  endDate: string
  cloudCover: number
  areaCoverage: number
  selectedCollection?: string[]
}

// Function to convert date string to RFC3339 format
const convertToRFC3339 = (dateString: string, isEndDate: boolean = false): string => {
  if (!dateString) return ''

  // Handle month input format (YYYY-MM) by appending appropriate day
  let fullDateString = dateString
  if (dateString.match(/^\d{4}-\d{2}$/)) {
    if (isEndDate) {
      // For end date, use the last day of the month
      const [year, month] = dateString.split('-')
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      fullDateString = `${dateString}-${lastDay.toString().padStart(2, '0')}`
    } else {
      // For start date, use the first day of the month
      fullDateString = dateString + '-01'
    }
  }

  // Create a Date object and convert to ISO string (RFC3339 format)
  return new Date(fullDateString).toISOString()
}

export const tileDataFromStacFeature = (item: StacFeature): SearchResult => {
  // Calculate area coverage as 100 - nodata_pixel_percentage
  const nodataPercentage = item.properties['s2:nodata_pixel_percentage'] || 0
  const areaCoverage = 100 - nodataPercentage

  const result = {
    id: item.id,
    date: new Date(item.properties.datetime).toLocaleDateString(),
    formattedDate: new Date(item.properties.datetime).toLocaleDateString(),
    cloudCover: item.properties['eo:cloud_cover'] || 'N/A',
    areaCoverage: areaCoverage,
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

// Function to search the STAC API
export default async function searchStacApi(
  bbox?: number[],
  resetSearch = true,
  settings?: SearchSettings,
): Promise<SearchResponse | undefined> {
  // Reset counters for new search
  if (resetSearch) {
    totalResultsReturned = 0
    totalNumberMatched = 0
  }

  // Use provided settings or fall back to DOM elements
  const startDate = settings?.startDate ? convertToRFC3339(settings.startDate) : ''
  const endDate = settings?.endDate ? convertToRFC3339(settings.endDate, true) : ''
  const cloudCover = settings?.cloudCover || 10
  const areaCoverage = settings?.areaCoverage || 60

  try {
    // Build request body for POST
    const requestBody: any = {
      collections: settings?.selectedCollection || ['sentinel-2-c1-l2a'],
      limit: 20,
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
      // Convert from EPSG:3857 to EPSG:4326 (WGS84) if needed
      const [minX, minY, maxX, maxY] = bbox

      // Import the transform function from OpenLayers
      const { transform } = await import('ol/proj')

      // Transform coordinates from EPSG:3857 to EPSG:4326
      const [minLon, minLat] = transform([minX, minY], 'EPSG:3857', 'EPSG:4326')
      const [maxLon, maxLat] = transform([maxX, maxY], 'EPSG:3857', 'EPSG:4326')

      requestBody.bbox = [minLon, minLat, maxLon, maxLat]
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
