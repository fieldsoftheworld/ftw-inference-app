import { watch } from 'vue'
import type Map from 'ol/Map'
import {
  activeTileId,
  currentMgrsTileId,
  drawnExtent,
  secondActiveTileId,
  triggerTileSelection,
} from './useAreaOfInterest'
import { map, areaValues } from './useMap'
import { handleSearchResults } from './useSearch'
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj'
import { Extent } from 'ol/extent'

export interface PermalinkState {
  zoom: number
  center: [number, number]
  currentMgrsTileId: string | null
  activeTileId: string | null
  secondActiveTileId: string | null
  bbox?: Extent
  // Search settings - only included when currentMgrsTileId is present
  startDate?: string
  endDate?: string
  cloudCover?: number
  areaCoverage?: number
}

let registered = false
let shouldUpdate = true

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
        center: [parseFloat(parts[2]), parseFloat(parts[1])] as [number, number],
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

      // Parse search settings
      for (let i = 6; i < parts.length; i++) {
        const part = parts[i]
        if (part.startsWith('start_date:')) {
          result.startDate = part.substring(11)
        } else if (part.startsWith('end_date:')) {
          result.endDate = part.substring(9)
        } else if (part.startsWith('cloud_cover:')) {
          result.cloudCover = Number(part.substring(12))
        } else if (part.startsWith('area_coverage:')) {
          result.areaCoverage = Number(part.substring(14))
        } else if (part.startsWith('bbox:')) {
          result.bbox = part.substring(5).split(',').map(Number)
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
const updatePermalink = (
  map: Map,
  drawnExtent: Extent | null,
  currentMgrsTileId: string | null,
  activeTileId: string | null,
  secondActiveTileId: string | null,
) => {
  if (!shouldUpdate) {
    shouldUpdate = true
    return
  }

  const view = map.getView()
  const viewCenter = view.getCenter()
  const zoom = view.getZoom()
  if (!viewCenter || zoom === undefined) return

  const center = toLonLat(viewCenter)

  const extent = drawnExtent
    ? transformExtent(drawnExtent, 'EPSG:3857', 'EPSG:4326').map((coord) =>
        Number(coord.toFixed(4)),
      )
    : null

  // Build hash parts, excluding null values
  const hashParts = [zoom.toFixed(2), center[1].toFixed(4), center[0].toFixed(4)]

  if (currentMgrsTileId) {
    // Add tile IDs
    hashParts.push(currentMgrsTileId)
    hashParts.push(String(activeTileId))
    hashParts.push(String(secondActiveTileId))

    if (extent) {
      hashParts.push(`bbox:${[extent[1], extent[0], extent[3], extent[2]].join(',')}`)
    }

    // If we have a currentMgrsTileId, include search settings
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

  const hash = `#map=${hashParts.join('/')}`

  const state: PermalinkState = {
    zoom,
    center: [center[1], center[0]],
    currentMgrsTileId,
    activeTileId,
    secondActiveTileId,
    bbox: extent || undefined,
  }
  window.history.pushState(state, 'map', hash)
}

// Restore map state from permalink
const restoreMapState = (map: Map, state: PermalinkState) => {
  const view = map.getView()

  // Set center and zoom
  view.setCenter(fromLonLat(state.center))
  view.setZoom(state.zoom)

  // Note: Tile IDs will be restored by the calling component
  // since they need to be set in the composable state
}

// Setup permalink functionality
const setupPermalink = async () => {
  if (!map.value) {
    throw new Error('Map is not initialized yet')
  }
  if (registered) {
    return
  }
  registered = true

  watch(
    () => [
      map.value,
      drawnExtent.value,
      currentMgrsTileId.value,
      activeTileId.value,
      secondActiveTileId.value,
    ],
    () => {
      if (!map.value) {
        return
      }
      // Update permalink after tile selection changes
      updateTileSelection(
        map.value,
        drawnExtent.value,
        currentMgrsTileId.value,
        activeTileId.value,
        secondActiveTileId.value,
      )
    },
  )

  // Restore initial state from URL
  const initialState = parsePermalink()
  restoreMapState(map.value, initialState)

  // Update the refs with the restored values
  currentMgrsTileId.value = initialState.currentMgrsTileId
  activeTileId.value = initialState.activeTileId
  secondActiveTileId.value = initialState.secondActiveTileId

  // If we have a restored MGRS tile ID, trigger the search
  if (initialState.currentMgrsTileId) {
    await triggerTileSelection(
      map.value!,
      currentMgrsTileId.value!,
      areaValues.value!,
      handleSearchResults,
      undefined,
      false,
    )
  }
  const initialBbox = initialState.bbox
  if (initialBbox) {
    drawnExtent.value = transformExtent(
      [initialBbox[1], initialBbox[0], initialBbox[3], initialBbox[2]],
      'EPSG:4326',
      'EPSG:3857',
    )
  }

  // Update permalink when map moves
  map.value.on('moveend', () => {
    updatePermalink(
      map.value!,
      drawnExtent.value,
      currentMgrsTileId.value,
      activeTileId.value,
      secondActiveTileId.value,
    )
  })

  // Handle browser back/forward navigation
  window.addEventListener('popstate', (event) => {
    if (event.state === null) {
      return
    }

    const state = event.state as PermalinkState
    restoreMapState(map.value!, state)

    // Update the refs
    currentMgrsTileId.value = state.currentMgrsTileId
    activeTileId.value = state.activeTileId
    secondActiveTileId.value = state.secondActiveTileId

    // If we have a restored MGRS tile ID, trigger the search
    if (state.currentMgrsTileId) {
      triggerTileSelection(
        map.value!,
        currentMgrsTileId.value!,
        areaValues.value!,
        handleSearchResults,
        undefined,
        false,
      )
    }

    shouldUpdate = false
  })
}

// Update permalink when tile selection changes
const updateTileSelection = (
  map: Map,
  drawnExtent: Extent | null,
  currentMgrsTileId: string | null,
  activeTileId: string | null,
  secondActiveTileId: string | null,
) => {
  updatePermalink(map, drawnExtent, currentMgrsTileId, activeTileId, secondActiveTileId)
}

export function usePermalink() {
  return { setupPermalink }
}
