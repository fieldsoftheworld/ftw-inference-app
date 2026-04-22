import { type Ref, watch } from 'vue'
import type Map from 'ol/Map'
import useAreaOfInterest from './useAreaOfInterest'
import useMap from './useMap'
import useSearch from './useSearch'
import useSettings, { type Settings } from './useSettings'
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj'
import { type Extent } from 'ol/extent'
import { type Coordinate } from 'ol/coordinate'

export interface PermalinkState {
  mode: string
  zoom: number
  center: Coordinate
  year?: number
}

export interface PermalinkStateInference extends PermalinkState {
  currentMgrsTileId: string | null
  activeTileId: string | null
  secondActiveTileId: string | null
  bbox?: Extent
  // Search settings - only included when currentMgrsTileId is present
  startMonth?: number
  endMonth?: number
  cloudCover?: number
  areaCoverage?: number
  buffer?: number
}

export interface PermalinkStateGlobal extends PermalinkState {
  threshold: number
  opacity: number
  downloads: boolean
}

export function buildGlobalPermalinkParts(settings: Settings): string[] {
  const hashParts = [`threshold:${settings.threshold}`]
  if (settings.year) {
    hashParts.push(`year:${settings.year}`)
  }
  hashParts.push(`opacity:${settings.opacity}`)
  hashParts.push(`downloads:${settings.downloads ? 1 : 0}`)
  return hashParts
}

const DEFAULT_INFERENCE_STATE: PermalinkStateInference = {
  mode: 'inference',
  zoom: 2,
  center: [0, 0],
  currentMgrsTileId: null,
  activeTileId: null,
  secondActiveTileId: null,
}

const DEFAULT_GLOBAL_STATE: PermalinkStateGlobal = {
  mode: 'global',
  zoom: 2,
  center: [0, 0],
  year: 2025,
  threshold: 0.4,
  opacity: 90,
  downloads: false,
}

export function getDefaultPermalinkState(
  mode: string,
): PermalinkStateInference | PermalinkStateGlobal {
  return mode === 'inference' ? { ...DEFAULT_INFERENCE_STATE } : { ...DEFAULT_GLOBAL_STATE }
}

export function parsePermalinkHash(
  hash: string,
  defaultMode: string,
  availableModes: { id: string }[],
): PermalinkStateInference | PermalinkStateGlobal | null {
  const getDefaultState = (mode: string): PermalinkStateInference | PermalinkStateGlobal => {
    return getDefaultPermalinkState(mode)
  }

  if (hash === '') {
    return null
  }

  try {
    const parts = hash.replace('#map=', '').split('/')

    if (parts.length >= 3) {
      const zoom = parseFloat(parts[0]) || 2
      const center: Coordinate = [parseFloat(parts[1]), parseFloat(parts[2])]

      const keyValuePrefixes = [
        'mode:',
        'start_month:',
        'end_month:',
        'cloud_cover:',
        'area_coverage:',
        'buffer:',
        'bbox:',
        'year:',
        'field_boundaries:',
        'threshold:',
        'opacity:',
        'downloads:',
      ]
      let mode = defaultMode
      let hasExplicitMode = false
      const keyValueParts: string[] = []
      const positionalParts: string[] = []

      for (let i = 3; i < parts.length; i++) {
        const part = parts[i]
        if (keyValuePrefixes.some((prefix) => part.startsWith(prefix))) {
          keyValueParts.push(part)
          if (part.startsWith('mode:')) {
            const parsedMode = part.substring(5).trim()
            if (availableModes.some((m) => m.id === parsedMode)) {
              mode = parsedMode
              hasExplicitMode = true
            }
          }
        } else if (part) {
          positionalParts.push(part)
        }
      }

      if (!hasExplicitMode && positionalParts.length > 0) {
        mode = 'inference'
      }

      if (mode === 'inference') {
        const result: PermalinkStateInference = {
          mode,
          zoom,
          center,
          currentMgrsTileId: null,
          activeTileId: null,
          secondActiveTileId: null,
        }

        for (const part of keyValueParts) {
          if (part.startsWith('start_month:')) {
            const startMonth = parseInt(part.substring(12), 10)
            if (startMonth > 0) result.startMonth = startMonth
          } else if (part.startsWith('end_month:')) {
            const endMonth = parseInt(part.substring(10), 10)
            if (endMonth > 0) result.endMonth = endMonth
          } else if (part.startsWith('cloud_cover:')) {
            const cloudCover = parseInt(part.substring(12), 10)
            if (!isNaN(cloudCover)) result.cloudCover = cloudCover
          } else if (part.startsWith('area_coverage:')) {
            const areaCoverage = parseInt(part.substring(14), 10)
            if (!isNaN(areaCoverage)) result.areaCoverage = areaCoverage
          } else if (part.startsWith('buffer:')) {
            const buffer = parseInt(part.substring(7), 10)
            if (!isNaN(buffer)) result.buffer = buffer
          } else if (part.startsWith('bbox:')) {
            const bbox = part.substring(5).split(',').map(Number)
            if (bbox.length === 4 && bbox.every((num) => !isNaN(num))) result.bbox = bbox
          } else if (part.startsWith('year:')) {
            const year = parseInt(part.substring(5), 10)
            if (!isNaN(year)) result.year = year
          }
        }

        if (positionalParts.length >= 1) result.currentMgrsTileId = positionalParts[0]
        if (positionalParts.length >= 2) result.activeTileId = positionalParts[1]
        if (positionalParts.length >= 3) result.secondActiveTileId = positionalParts[2]

        return result
      }

      const result: PermalinkStateGlobal = {
        mode,
        zoom,
        center,
        threshold: DEFAULT_GLOBAL_STATE.threshold,
        opacity: DEFAULT_GLOBAL_STATE.opacity,
        downloads: DEFAULT_GLOBAL_STATE.downloads,
      }

      for (const part of keyValueParts) {
        if (part.startsWith('threshold:')) {
          const val = parseFloat(part.substring(10))
          if (!isNaN(val)) result.threshold = val
        } else if (part.startsWith('year:')) {
          const year = parseInt(part.substring(5), 10)
          if (!isNaN(year)) result.year = year
        } else if (part.startsWith('opacity:')) {
          const opacity = parseInt(part.substring(8), 10)
          result.opacity = isNaN(opacity) ? 90 : opacity
        } else if (part.startsWith('downloads:')) {
          result.downloads = part.substring(10) === '1'
        }
      }

      return result
    }
  } catch (error) {
    console.error('Error parsing permalink:', error)
  }

  return getDefaultState(defaultMode)
}

export default function usePermalink() {
  const { handleSearchResults } = useSearch()
  const { settings, defaultMode, availableModes } = useSettings()
  const { activeTileId, currentMgrsTileId, drawnExtent, secondActiveTileId, triggerTileSelection } =
    useAreaOfInterest()
  const { areaValues } = useMap()

  let registered = false
  let shouldUpdate = true

  function isInferenceState(state: PermalinkState): state is PermalinkStateInference {
    return state.mode === 'inference'
  }

  function isGlobalState(state: PermalinkState): state is PermalinkStateGlobal {
    return state.mode === 'global'
  }

  // Parse permalink from URL hash
  const parsePermalink = (): PermalinkStateInference | PermalinkStateGlobal | null => {
    return parsePermalinkHash(window.location.hash, defaultMode, availableModes)
  }

  // Update permalink in URL
  const updatePermalink = (map: Map) => {
    if (!shouldUpdate) {
      shouldUpdate = true
      return
    }

    const mode = settings.value.mode || defaultMode
    const view = map.getView()
    const viewCenter = view.getCenter()
    const zoom = view.getZoom()
    if (!viewCenter || zoom === undefined) return

    const center = toLonLat(viewCenter)

    // Build hash parts, excluding null values
    const hashParts = [zoom.toFixed(2), center[0].toFixed(4), center[1].toFixed(4)]

    if (mode) {
      hashParts.push(`mode:${mode}`)
    }

    let state: PermalinkStateInference | PermalinkStateGlobal

    if (mode === 'inference') {
      const extent = drawnExtent.value
        ? transformExtent(drawnExtent.value, 'EPSG:3857', 'EPSG:4326').map((coord) =>
            Number(coord.toFixed(4)),
          )
        : null

      if (currentMgrsTileId.value) {
        // Add tile IDs
        hashParts.push(currentMgrsTileId.value)
        hashParts.push(
          String(
            !settings.value.autoSceneSelection && activeTileId.value ? activeTileId.value : '',
          ),
        )
        hashParts.push(
          String(
            !settings.value.autoSceneSelection && secondActiveTileId.value
              ? secondActiveTileId.value
              : '',
          ),
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

      state = {
        mode,
        zoom,
        center,
        currentMgrsTileId: currentMgrsTileId.value,
        activeTileId: activeTileId.value,
        secondActiveTileId: secondActiveTileId.value,
        bbox: extent || undefined,
      }
    } else {
      // Global mode
      hashParts.push(...buildGlobalPermalinkParts(settings.value))

      state = {
        mode,
        zoom,
        center,
        threshold: settings.value.threshold,
        year: settings.value.year,
        opacity: settings.value.opacity,
        downloads: settings.value.downloads,
      }
    }

    const hash = `#map=${hashParts.join('/')}`
    try {
      window.history.pushState(state, 'map', hash)
    } catch (error) {
      console.error('Error updating permalink:', error)
    }
  }

  // Restore map state from permalink
  const restoreMapState = (map: Map, state: PermalinkState) => {
    const view = map.getView()
    view.setCenter(fromLonLat(state.center))
    view.setZoom(state.zoom)
  }

  function restoreInferenceState(state: PermalinkStateInference) {
    let newAutoSceneSelectionValue = true
    if (state.year) {
      settings.value.year = state.year
      newAutoSceneSelectionValue = true
    }
    if (state.activeTileId || state.secondActiveTileId) {
      newAutoSceneSelectionValue = false
    }
    settings.value.autoSceneSelection = newAutoSceneSelectionValue

    currentMgrsTileId.value = state.currentMgrsTileId
    activeTileId.value = state.activeTileId
    secondActiveTileId.value = state.secondActiveTileId
  }

  function restoreGlobalState(state: PermalinkStateGlobal) {
    settings.value.threshold = state.threshold
    settings.value.opacity = state.opacity
    settings.value.downloads = state.downloads
    if (state.year) {
      settings.value.year = state.year
    }
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
        settings.value.mode,
        settings.value.autoSceneSelection,
        settings.value.year,
        settings.value.endMonth,
        settings.value.startMonth,
        settings.value.cloudCover,
        settings.value.areaCoverage,
        settings.value.buffer,
        settings.value.threshold,
        settings.value.opacity,
        settings.value.downloads,
      ],
      () => {
        if (!map.value) {
          return
        }
        updatePermalink(map.value)
      },
    )

    // Restore initial state from URL; when there is no hash, keep settings already
    // loaded from localStorage and only fall back to defaults for map view position
    const parsedState = parsePermalink()
    const initialState = parsedState ?? getDefaultPermalinkState(defaultMode)
    settings.value.mode = parsedState ? parsedState.mode : settings.value.mode
    restoreMapState(map.value, initialState)

    if (parsedState && isInferenceState(parsedState)) {
      restoreInferenceState(parsedState)

      if (parsedState.currentMgrsTileId) {
        await triggerTileSelection(
          map.value!,
          currentMgrsTileId.value!,
          areaValues.value!,
          handleSearchResults,
          undefined,
          false,
        )
      }
      if (parsedState.bbox) {
        drawnExtent.value = transformExtent(parsedState.bbox, 'EPSG:4326', 'EPSG:3857')
      }
    } else if (parsedState && isGlobalState(parsedState)) {
      restoreGlobalState(parsedState)
    }

    // Update permalink when map moves
    map.value.on('moveend', () => {
      updatePermalink(map.value!)
    })

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
      if (event.state === null) {
        return
      }

      const state = event.state as PermalinkState
      settings.value.mode = state.mode
      restoreMapState(map.value!, state)

      if (isInferenceState(state)) {
        restoreInferenceState(state)

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
      } else if (isGlobalState(state)) {
        restoreGlobalState(state)
      }

      shouldUpdate = false
    })
  }

  return { setupPermalink }
}
