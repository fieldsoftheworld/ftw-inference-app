import { type Ref, watch } from 'vue'
import type Map from 'ol/Map'
import useAreaOfInterest from './useAreaOfInterest'
import useMap from './useMap'
import useSearch from './useSearch'
import useSettings from './useSettings'
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj'
import { type Extent } from 'ol/extent'
import { type Coordinate } from 'ol/coordinate'

export interface PermalinkState {
  zoom: number
  center: Coordinate
  currentMgrsTileId: string | null
  activeTileId: string | null
  secondActiveTileId: string | null
  bbox?: Extent
  // Search settings - only included when currentMgrsTileId is present
  year?: number
  startMonth?: number
  endMonth?: number
  cloudCover?: number
  areaCoverage?: number
  buffer?: number
}

export default function usePermalink() {
  const { handleSearchResults } = useSearch()
  const { settings } = useSettings()
  const { activeTileId, currentMgrsTileId, drawnExtent, secondActiveTileId, triggerTileSelection } =
    useAreaOfInterest()
  const { areaValues } = useMap()

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
          center: [parseFloat(parts[1]), parseFloat(parts[2])] as [number, number],
          currentMgrsTileId: null,
          activeTileId: null,
          secondActiveTileId: null,
        }

        // Parse additional parts as tile IDs (only if they exist and are not null)
        if (parts.length >= 4 && parts[3]) {
          result.currentMgrsTileId = parts[3]
        }
        if (parts.length >= 5 && parts[4]) {
          result.activeTileId = parts[4]
        }
        if (parts.length >= 6 && parts[5]) {
          result.secondActiveTileId = parts[5]
        }

        // Parse search settings
        for (let i = 6; i < parts.length; i++) {
          const part = parts[i]
          if (part.startsWith('start_month:')) {
            const startMonth = parseInt(part.substring(12), 10)
            if (startMonth > 0) {
              result.startMonth = startMonth
            }
          } else if (part.startsWith('end_month:')) {
            const endMonth = parseInt(part.substring(10), 10)
            if (endMonth > 0) {
              result.endMonth = endMonth
            }
          } else if (part.startsWith('cloud_cover:')) {
            const cloudCover = parseInt(part.substring(12), 10)
            if (!isNaN(cloudCover)) {
              result.cloudCover = cloudCover
            }
          } else if (part.startsWith('area_coverage:')) {
            const areaCoverage = parseInt(part.substring(14), 10)
            if (!isNaN(areaCoverage)) {
              result.areaCoverage = areaCoverage
            }
          } else if (part.startsWith('buffer:')) {
            const buffer = parseInt(part.substring(7), 10)
            if (!isNaN(buffer)) {
              result.buffer = buffer
            }
          } else if (part.startsWith('bbox:')) {
            const bbox = part.substring(5).split(',').map(Number)
            if (bbox.length === 4 && bbox.every((num) => !isNaN(num))) {
              result.bbox = bbox
            }
          } else if (part.startsWith('year:')) {
            const year = parseInt(part.substring(5), 10)
            if (!isNaN(year)) {
              result.year = year
            }
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
    const hashParts = [zoom.toFixed(2), center[0].toFixed(4), center[1].toFixed(4)]

    if (currentMgrsTileId) {
      // Add tile IDs
      hashParts.push(currentMgrsTileId)
      hashParts.push(String(!settings.value.autoSceneSelection && activeTileId ? activeTileId : ''))
      hashParts.push(
        String(!settings.value.autoSceneSelection && secondActiveTileId ? secondActiveTileId : ''),
      )

      if (extent) {
        hashParts.push(`bbox:${extent.join(',')}`)
      }

      if (settings.value.year) {
        hashParts.push(`year:${settings.value.year}`)
      }

      // If we have a currentMgrsTileId, include search settings
      const stored = localStorage.getItem('ftw-search-settings')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          // Add search settings to the hash
          if (parsed.startMonth) hashParts.push(`start_month:${parsed.startMonth}`)
          if (parsed.endMonth) hashParts.push(`end_month:${parsed.endMonth}`)
          if (parsed.cloudCover !== undefined) hashParts.push(`cloud_cover:${parsed.cloudCover}`)
          if (parsed.areaCoverage !== undefined) {
            hashParts.push(`area_coverage:${parsed.areaCoverage}`)
          }
          if (parsed.buffer !== undefined) hashParts.push(`buffer:${parsed.buffer}`)
        } catch (error) {
          console.error('Error parsing stored settings for permalink:', error)
        }
      }
    }

    const hash = `#map=${hashParts.join('/')}`

    const state: PermalinkState = {
      zoom,
      center,
      currentMgrsTileId,
      activeTileId,
      secondActiveTileId,
      bbox: extent || undefined,
    }
    try {
      window.history.pushState(state, 'map', hash)
    } catch (error) {
      console.error('Error updating permalink:', error)
    }
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

  function restoreAutoSceneState(state: PermalinkState) {
    let newAutoSceneSelectionValue = true
    if (state.year) {
      settings.value.year = state.year
      newAutoSceneSelectionValue = true
    }
    if (state.activeTileId || state.secondActiveTileId) {
      newAutoSceneSelectionValue = false
    }
    settings.value.autoSceneSelection = newAutoSceneSelectionValue
  }

  // Setup permalink functionality
  const setupPermalink = async (map: Ref<Map | null>) => {
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
        settings.value.autoSceneSelection,
        settings.value.year,
        settings.value.endMonth,
        settings.value.startMonth,
        settings.value.cloudCover,
        settings.value.areaCoverage,
        settings.value.buffer,
      ],
      () => {
        if (!map.value) {
          return
        }
        // Update permalink after tile selection changes
        updatePermalink(
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
    restoreAutoSceneState(initialState)

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
      drawnExtent.value = transformExtent(initialBbox, 'EPSG:4326', 'EPSG:3857')
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
      restoreAutoSceneState(state)

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

  return { setupPermalink }
}
