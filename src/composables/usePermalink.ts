import { ref, type Ref } from 'vue'
import type { Map } from 'ol'

export interface PermalinkState {
  zoom: number
  center: [number, number]
  currentMgrsTileId: string | null
  activeTileId: string | null
  secondActiveTileId: string | null
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

        // Parse search settings
        for (let i = 6; i < parts.length; i++) {
          const part = parts[i]
          if (part.startsWith('s:')) {
            result.startDate = part.substring(2)
          } else if (part.startsWith('e:')) {
            result.endDate = part.substring(2)
          } else if (part.startsWith('c:')) {
            result.cloudCover = parseInt(part.substring(2))
          } else if (part.startsWith('a:')) {
            result.areaCoverage = parseInt(part.substring(2))
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
    currentMgrsTileId: string | null,
    activeTileId: string | null,
    secondActiveTileId: string | null,
  ) => {
    if (!shouldUpdate.value) {
      shouldUpdate.value = true
      return
    }

    const view = map.getView()
    const center = view.getCenter()
    const zoom = view.getZoom()

    if (!center || zoom === undefined) return

    // Build hash parts, excluding null values
    const hashParts = [zoom.toFixed(2), center[0].toFixed(2), center[1].toFixed(2)]

    // Only add non-null tile IDs to the hash
    if (currentMgrsTileId) hashParts.push(currentMgrsTileId)
    if (activeTileId) hashParts.push(activeTileId)
    if (secondActiveTileId) hashParts.push(secondActiveTileId)

    // If we have a currentMgrsTileId, include search settings
    if (currentMgrsTileId) {
      const stored = localStorage.getItem('ftw-search-settings')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          // Add search settings to the hash
          if (parsed.startDate) hashParts.push(`s:${parsed.startDate}`)
          if (parsed.endDate) hashParts.push(`e:${parsed.endDate}`)
          if (parsed.cloudCover !== undefined) hashParts.push(`c:${parsed.cloudCover}`)
          if (parsed.areaCoverage !== undefined) hashParts.push(`a:${parsed.areaCoverage}`)
        } catch (error) {
          console.error('Error parsing stored settings for permalink:', error)
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
    }

    window.history.pushState(state, 'map', hash)
  }

  // Restore map state from permalink
  const restoreMapState = (map: Map, state: PermalinkState) => {
    const view = map.getView()

    // Set center and zoom
    view.setCenter(state.center)
    view.setZoom(state.zoom)

    // Note: Tile IDs will be restored by the calling component
    // since they need to be set in the composable state
  }

  // Setup permalink functionality
  const setupPermalink = (
    map: Map,
    currentMgrsTileId: Ref<string | null>,
    activeTileId: Ref<string | null>,
    secondActiveTileId: Ref<string | null>,
    onTileRestore?: (mgrsTileId: string, searchSettings?: any) => void,
  ) => {
    // Restore initial state from URL
    const initialState = parsePermalink()
    restoreMapState(map, initialState)

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
        onTileRestore(initialState.currentMgrsTileId!, searchSettings)
      }, 100)
    }

    // Update permalink when map moves
    map.on('moveend', () => {
      updatePermalink(map, currentMgrsTileId.value, activeTileId.value, secondActiveTileId.value)
    })

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
      if (event.state === null) {
        return
      }

      const state = event.state as PermalinkState
      restoreMapState(map, state)

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

        onTileRestore(state.currentMgrsTileId, searchSettings)
      }

      shouldUpdate.value = false
    })
  }

  // Update permalink when tile selection changes
  const updateTileSelection = (
    map: Map,
    currentMgrsTileId: string | null,
    activeTileId: string | null,
    secondActiveTileId: string | null,
  ) => {
    updatePermalink(map, currentMgrsTileId, activeTileId, secondActiveTileId)
  }

  return {
    parsePermalink,
    updatePermalink,
    restoreMapState,
    setupPermalink,
    updateTileSelection,
  }
}
