import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import Feature from 'ol/Feature'
import Polygon from 'ol/geom/Polygon'
import useDownloadGrid, { featureToGridCell } from '../useDownloadGrid'
import { getDownloadParquetUrl, DOWNLOAD_GRID_URL } from '../../layers/Download-Grid-Layer'
import useSettings from '../useSettings'

describe('getDownloadParquetUrl', () => {
  it('builds a Source Cooperative URL using year and tile id', () => {
    expect(getDownloadParquetUrl(2025, 'N40W100')).toBe(
      'https://data.source.coop/ftw/global-field-boundaries/download-tiles/geoparquet/2025/N40W100.parquet',
    )
  })

  it('handles southern/western hemisphere tiles', () => {
    expect(getDownloadParquetUrl(2024, 'S03E036')).toBe(
      'https://data.source.coop/ftw/global-field-boundaries/download-tiles/geoparquet/2024/S03E036.parquet',
    )
  })
})

describe('DOWNLOAD_GRID_URL', () => {
  it('points to the download-tiles manifest on Source Cooperative', () => {
    expect(DOWNLOAD_GRID_URL).toBe(
      'https://data.source.coop/ftw/global-field-boundaries/download-tiles/ftw-download-grid.geojson',
    )
  })
})

describe('featureToGridCell', () => {
  it('extracts tile metadata from feature properties', () => {
    const feature = new Feature({
      geometry: new Polygon([
        [
          [0, 40],
          [1, 40],
          [1, 41],
          [0, 41],
          [0, 40],
        ],
      ]),
      tile_id: 'N40E000',
      lat_min: 40,
      lon_min: 0,
      years: [2024, 2025],
      feature_count: 1234,
      size_bytes: 2_500_000,
    })

    const cell = featureToGridCell(feature)
    expect(cell).toEqual({
      tile_id: 'N40E000',
      lat_min: 40,
      lon_min: 0,
      years: [2024, 2025],
      feature_count: 1234,
      size_bytes: 2_500_000,
    })
  })

  it('falls back to feature id when tile_id is missing', () => {
    const feature = new Feature({
      geometry: new Polygon([
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ]),
    })
    feature.setId('S01W001')
    const cell = featureToGridCell(feature)
    expect(cell.tile_id).toBe('S01W001')
  })

  it('leaves optional stats undefined when not present', () => {
    const feature = new Feature({
      tile_id: 'N00E000',
      lat_min: 0,
      lon_min: 0,
      years: [2025],
    })
    const cell = featureToGridCell(feature)
    expect(cell.feature_count).toBeUndefined()
    expect(cell.size_bytes).toBeUndefined()
  })

  it('defaults years to an empty array when absent', () => {
    const feature = new Feature({
      tile_id: 'N00E000',
      lat_min: 0,
      lon_min: 0,
    })
    expect(featureToGridCell(feature).years).toEqual([])
  })
})

describe('useDownloadGrid', () => {
  beforeEach(() => {
    const { settings } = useSettings()
    const { showDownloadModal, selectedGridCell } = useDownloadGrid()
    settings.value.downloads = false
    settings.value.mode = 'global'
    showDownloadModal.value = false
    selectedGridCell.value = null
  })

  it('uses settings as the source of truth for downloads visibility', () => {
    useDownloadGrid()
    const { settings } = useSettings()

    settings.value.downloads = true
    expect(settings.value.downloads).toBe(true)

    settings.value.downloads = false
    expect(settings.value.downloads).toBe(false)
  })

  it('closes the modal via closeDownloadModal', () => {
    const { showDownloadModal, selectedGridCell, closeDownloadModal } = useDownloadGrid()
    showDownloadModal.value = true
    selectedGridCell.value = {
      tile_id: 'N40W100',
      lat_min: 40,
      lon_min: -100,
      years: [2025],
    }
    closeDownloadModal()
    expect(showDownloadModal.value).toBe(false)
    expect(selectedGridCell.value).toBeNull()
  })

  it('turns off the download grid when the user leaves global mode', async () => {
    const { settings } = useSettings()
    useDownloadGrid()

    settings.value.mode = 'global'
    settings.value.downloads = true
    await nextTick()

    settings.value.mode = 'inference'
    await nextTick()

    expect(settings.value.downloads).toBe(false)

    // restore
    settings.value.mode = 'global'
  })

  it('handleGridClick returns false when the grid is hidden', () => {
    const { handleGridClick } = useDownloadGrid()
    const { settings } = useSettings()
    settings.value.downloads = false
    const fakeMap = { forEachFeatureAtPixel: vi.fn() } as any
    expect(handleGridClick(fakeMap, [0, 0])).toBe(false)
    expect(fakeMap.forEachFeatureAtPixel).not.toHaveBeenCalled()
  })

  it('persists the grid visibility in stored settings', async () => {
    const { settings } = useSettings()
    useDownloadGrid()

    settings.value.downloads = true
    await nextTick()

    expect(JSON.parse(localStorage.getItem('ftw-search-settings') || '{}')).toMatchObject({
      downloads: true,
    })
    expect(settings.value.downloads).toBe(true)
  })
})
