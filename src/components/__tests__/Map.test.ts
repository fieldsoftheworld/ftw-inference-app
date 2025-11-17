import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Map from '../MapComponent.vue'
import ResizeObserver from 'resize-observer-polyfill'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import VuetifyNotifier from 'vuetify-notifier'

global.ResizeObserver = ResizeObserver

describe('Map', () => {
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
})
