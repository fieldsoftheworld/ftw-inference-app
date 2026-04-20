import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Map from '../MapComponent.vue'
import ResizeObserver from 'resize-observer-polyfill'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import VuetifyNotifier from 'vuetify-notifier'
import MatchMediaMock from 'vitest-matchmedia-mock'

vi.mock('../../layers/Global-Predictions-Layer', async () => {
  const { default: TileLayer } = await import('ol/layer/Tile')
  return {
    createGlobalPredictionsLayer: vi.fn(() => ({
      layer: new TileLayer(),
      update: vi.fn(),
      dispose: vi.fn(),
    })),
  }
})
vi.mock('../../layers/Global-Overview-Layers', async () => {
  const { default: GlTileLayer } = await import('ol/layer/WebGLTile.js')
  return {
    createGlobalOverviewLayer: vi.fn(() => new GlTileLayer()),
  }
})

global.ResizeObserver = ResizeObserver

describe('Map', () => {
  const matchMediaMock = new MatchMediaMock()
  const vuetify = createVuetify({ components, directives })
  it('creates a map container div on mount', () => {
    const wrapper = mount(Map, {
      global: {
        plugins: [vuetify, VuetifyNotifier],
      },
    })
    const mapContainer = wrapper.find('#map')
    expect(mapContainer.exists()).toBe(true)
  })
  afterAll(() => {
    matchMediaMock.clear()
  })
})
