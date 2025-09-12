import { ref, type Ref } from 'vue'
import type { Map } from 'ol'

export interface PermalinkState {
  zoom: number
  center: [number, number]
  currentMgrsTileId: string | null
  activeTileId: string | null
  secondActiveTileId: string | null
  // Bounding box in longitude/latitude format [minx, miny, maxx, maxy]
  bbox?: [number, number, number, number]
  // Search settings - only included when currentMgrsTileId is present
  startDate?: string
  endDate?: string
  cloudCover?: number
  areaCoverage?: number
}

export function usePermalink() {
  const shouldUpdate = ref(true)

  // Default values
  const defaultState: PermalinkState = {
    zoom: 2,
    center: [0, 0],
    currentMgrsTileId: null,
    activeTileId: null,
    secondActiveTileId: null,
  }

  // Parse permalink from URL hash
  const parsePermalink = (): PermalinkState => {
    if (window.location.hash === '') {
      return defaultState
    }

    try {
      const hash = window.location.hash.replace('#map=', '')
      const parts = hash.split('/')

      if (parts.length >= 3) {
        const result: PermalinkState = {
          zoom: parseFloat(parts[0]) || defaultState.zoom,
          center: [parseFloat(parts[1]), parseFloat(parts[2])] as [number, number],
          currentMgrsTileId: null,
          activeTileId: null,
          secondActiveTileId: null,
        }

        // Parse additional parts as tile IDs (only if they exist and are not null)
        if (parts.length >= 4 && parts[3] !== 'null') {
          result.currentMgrsTileId = parts[3]
        }
        if (parts.length >= 5 && parts[4] !== 'null') {
          result.activeTileId = parts[4]
        }
        if (parts.length >= 6 && parts[5] !== 'null') {
          result.secondActiveTileId = parts[5]
        }

        // Parse bbox and search settings (bbox comes first after tile IDs)
        for (let i = 6; i < parts.length; i++) {
          const part = parts[i]
          if (part.startsWith('bbox:')) {
            // Parse bbox in format "bbox:minx,miny,maxx,maxy"
            const bboxStr = part.substring(5) // Remove "bbox:" prefix
            const bboxCoords = bboxStr.split(',').map(coord => parseFloat(coord))
            if (bboxCoords.length === 4 && bboxCoords.every(coord => !isNaN(coord))) {
              result.bbox = bboxCoords as [number, number, number, number]
            }
          } else if (part.startsWith('start_date:')) {
            result.startDate = part.substring(11) // Remove "start_date:" prefix
          } else if (part.startsWith('end_date:')) {
            result.endDate = part.substring(9) // Remove "end_date:" prefix
          } else if (part.startsWith('cloud_cover:')) {
            result.cloudCover = parseInt(part.substring(12)) // Remove "cloud_cover:" prefix
          } else if (part.startsWith('area_coverage:')) {
            result.areaCoverage = parseInt(part.substring(14)) // Remove "area_coverage:" prefix
          }
        }

        return result
      }
    } catch (error) {
      console.error('Error parsing permalink:', error)
    }

    return defaultState
  }

  // Update permalink in URL
  const updatePermalink = async (
    map: Map,
    currentMgrsTileId: string | null,
    activeTileId: string | null,
    secondActiveTileId: string | null,
    bbox?: [number, number, number, number],
  ) => {
    if (!shouldUpdate.value) {
      shouldUpdate.value = true
      return
    }

    const view = map.getView()
    const center = view.getCenter()
    const zoom = view.getZoom()

    if (!center || zoom === undefined) return

    // Convert center from Web Mercator to WGS84 (lat/long)
    const { transform } = await import('ol/proj')
    const wgs84Center = transform(center, 'EPSG:3857', 'EPSG:4326')

    // Build hash parts, excluding null values
    const hashParts = [
      zoom.toFixed(2), 
      parseFloat(wgs84Center[0].toPrecision(6)), 
      parseFloat(wgs84Center[1].toPrecision(6))
    ]

    // Only add non-null tile IDs to the hash
    if (currentMgrsTileId) hashParts.push(currentMgrsTileId)
    if (activeTileId) hashParts.push(activeTileId)
    if (secondActiveTileId) hashParts.push(secondActiveTileId)

    // If we have a currentMgrsTileId, include bbox and search settings
    if (currentMgrsTileId) {
      // Add bbox if provided (right after grid cell)
      if (bbox) {
        // Round to 8 significant digits
        const roundedBbox = bbox.map(coord => parseFloat(coord.toPrecision(8)))
        hashParts.push(`bbox:${roundedBbox.join(',')}`)
        
        // Only add search settings when we're updating with a bbox
        const stored = localStorage.getItem('ftw-search-settings')
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            // Add search settings to the hash
            if (parsed.startDate) hashParts.push(`start_date:${parsed.startDate}`)
            if (parsed.endDate) hashParts.push(`end_date:${parsed.endDate}`)
            if (parsed.cloudCover !== undefined) hashParts.push(`cloud_cover:${parsed.cloudCover}`)
            if (parsed.areaCoverage !== undefined)
              hashParts.push(`area_coverage:${parsed.areaCoverage}`)
          } catch (error) {
            console.error('Error parsing stored settings for permalink:', error)
          }
        }
      }
    }

    const hash = `#map=${hashParts.join('/')}`

    const state: PermalinkState = {
      zoom,
      center: [center[0], center[1]],
      currentMgrsTileId,
      activeTileId,
      secondActiveTileId,
      bbox,
    }

    window.history.pushState(state, 'map', hash)
  }

  // Restore map state from permalink
  const restoreMapState = async (map: Map, state: PermalinkState) => {
    const view = map.getView()

    // Convert center from WGS84 (lat/long) to Web Mercator
    const { transform } = await import('ol/proj')
    const webMercatorCenter = transform(state.center, 'EPSG:4326', 'EPSG:3857')

    // Set center and zoom
    view.setCenter(webMercatorCenter)
    view.setZoom(state.zoom)

    // Note: Tile IDs will be restored by the calling component
    // since they need to be set in the composable state
  }

  // Setup permalink functionality
  const setupPermalink = async (
    map: Map,
    currentMgrsTileId: Ref<string | null>,
    activeTileId: Ref<string | null>,
    secondActiveTileId: Ref<string | null>,
    onTileRestore?: (mgrsTileId: string, searchSettings?: any, bbox?: [number, number, number, number]) => void,
  ) => {
    // Restore initial state from URL
    const initialState = parsePermalink()
    await restoreMapState(map, initialState)

    // Update the refs with the restored values
    currentMgrsTileId.value = initialState.currentMgrsTileId
    activeTileId.value = initialState.activeTileId
    secondActiveTileId.value = initialState.secondActiveTileId

    // If we have a restored MGRS tile ID, trigger the search
    if (initialState.currentMgrsTileId && onTileRestore) {
      // Prepare search settings from permalink
      const searchSettings = {
        startDate: initialState.startDate || '',
        endDate: initialState.endDate || '',
        cloudCover: initialState.cloudCover || 10,
        areaCoverage: initialState.areaCoverage || 60,
      }

      // Use setTimeout to ensure the map is fully initialized
      setTimeout(() => {
        onTileRestore(initialState.currentMgrsTileId!, searchSettings, initialState.bbox)
      }, 100)
    }

    // Update permalink when map moves
    map.on('moveend', async () => {
      await updatePermalink(map, currentMgrsTileId.value, activeTileId.value, secondActiveTileId.value)
    })

    // Handle browser back/forward navigation
    window.addEventListener('popstate', async (event) => {
      if (event.state === null) {
        return
      }

      const state = event.state as PermalinkState
      await restoreMapState(map, state)

      // Update the refs
      currentMgrsTileId.value = state.currentMgrsTileId
      activeTileId.value = state.activeTileId
      secondActiveTileId.value = state.secondActiveTileId

      // If we have a restored MGRS tile ID, trigger the search
      if (state.currentMgrsTileId && onTileRestore) {
        // Prepare search settings from permalink
        const searchSettings = {
          startDate: state.startDate || '',
          endDate: state.endDate || '',
          cloudCover: state.cloudCover || 10,
          areaCoverage: state.areaCoverage || 60,
        }

        onTileRestore(state.currentMgrsTileId, searchSettings, state.bbox)
      }

      shouldUpdate.value = false
    })
  }

  // Update permalink when tile selection changes
  const updateTileSelection = async (
    map: Map,
    currentMgrsTileId: string | null,
    activeTileId: string | null,
    secondActiveTileId: string | null,
    bbox?: [number, number, number, number],
  ) => {
    await updatePermalink(map, currentMgrsTileId, activeTileId, secondActiveTileId, bbox)
  }

  return {
    parsePermalink,
    updatePermalink,
    restoreMapState,
    setupPermalink,
    updateTileSelection,
  }
}
