// Store the currently selected feature
let nextPageToken: string | null = null

interface SearchResult {
  id: string
  date: string
  cloudCover: number | string
  thumbnailUrl: string
  tiffUrl: string
  bounds: number[] | null
}

interface ProcessedResult extends Omit<SearchResult, 'date'> {
  date: Date
  formattedDate: string
}

interface SearchResponse {
  results: SearchResult[]
  hasMore: boolean
  totalFound: number
}

interface StacFeature {
  id: string
  properties: {
    datetime: string
    'eo:cloud_cover': number
    's2:vegetation_percentage': number
    's2:water_percentage': number
    's2:not_vegetated_percentage': number
    's2:unclassified_percentage': number
  }
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
  features: StacFeature[]
  links?: Array<{
    rel: string
    href: string
  }>
}

// Function to search the STAC API
export default async function searchStacApi(
  bbox?: number[],
  resetSearch = true,
): Promise<SearchResponse | undefined> {
  const startDate = (document.getElementById('start-date') as HTMLInputElement)?.value
  const endDate = (document.getElementById('end-date') as HTMLInputElement)?.value
  const cloudCover = (document.getElementById('cloud-cover') as HTMLInputElement)?.value || 10

  try {
    // Build query parameters
    const params = new URLSearchParams()

    // Add collection parameter
    params.append('collections', 'sentinel-2-l2a')

    // Add limit parameter
    params.append('limit', '20')

    // Add cloud cover filter using CQL2 text
    params.append('filter-lang', 'cql2-text')
    params.append('filter', `eo:cloud_cover<=${cloudCover}`)

    // Add datetime filter if dates are provided
    if (startDate && endDate) {
      params.append('datetime', `${startDate}/${endDate}`)
    } else if (startDate) {
      params.append('datetime', `${startDate}/..`)
    } else if (endDate) {
      params.append('datetime', `../${endDate}`)
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

      params.append('bbox', `${minLon},${minLat},${maxLon},${maxLat}`)
    }

    // Add the pagination token if we're loading more results
    if (!resetSearch && nextPageToken) {
      params.append('next', nextPageToken)
    }

    // Construct the URL with query parameters
    const searchUrl = `https://earth-search.aws.element84.com/v1/search?${params.toString()}`

    // Make the GET request
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/geo+json',
      },
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as StacResponse

    // Look for the "next" link which contains the pagination token
    let nextLink = null
    if (data.links) {
      nextLink = data.links.find((link) => link.rel === 'next')
    }

    // Store the pagination token if available
    if (nextLink && nextLink.href) {
      // Extract token from the URL - Earth Search uses 'next' parameter
      const tokenMatch = nextLink.href.match(/next=([^&]+)/)
      if (tokenMatch && tokenMatch[1]) {
        nextPageToken = decodeURIComponent(tokenMatch[1])
        // nextPageBtn.disabled = false;
      } else {
        nextPageToken = null
        // nextPageBtn.disabled = true;
      }
    } else {
      nextPageToken = null
      // nextPageBtn.disabled = true;
    }

    // Process and sort the results
    const results = data.features
      .map((item: StacFeature): ProcessedResult => {
        const result = {
          id: item.id,
          date: new Date(item.properties.datetime),
          formattedDate: new Date(item.properties.datetime).toLocaleDateString(),
          cloudCover: item.properties['eo:cloud_cover'] || 'N/A',
          thumbnailUrl: item.assets?.thumbnail?.href || item.assets?.visual?.href || '#',
          tiffUrl: item.assets?.blue?.href || '#',
          bounds: item.bbox
            ? item.bbox.length === 6
              ? [item.bbox[0], item.bbox[1], item.bbox[3], item.bbox[4]]
              : item.bbox
            : null,
        }
        return result
      })
      .sort((a: ProcessedResult, b: ProcessedResult) => {
        // First sort by date (newest first)
        const dateComparison = b.date.getTime() - a.date.getTime()
        if (dateComparison !== 0) return dateComparison

        // If dates are equal, sort by cloud cover (lowest first)
        const aCloudCover = typeof a.cloudCover === 'number' ? a.cloudCover : Infinity
        const bCloudCover = typeof b.cloudCover === 'number' ? b.cloudCover : Infinity
        return aCloudCover - bCloudCover
      })
      .map(
        (item: ProcessedResult): SearchResult => ({
          ...item,
          date: item.formattedDate, // Convert back to string for display
        }),
      )

    return {
      results,
      hasMore: !!nextPageToken,
      totalFound: data.features.length,
    }
  } catch (error) {
    console.error('Error searching Earth Search API:', error)
    throw error // Re-throw the error to be handled by the caller
  }
}
