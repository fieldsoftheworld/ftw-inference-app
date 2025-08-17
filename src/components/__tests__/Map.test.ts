import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Map from '../MapComponent.vue'
import ResizeObserver from 'resize-observer-polyfill'

global.ResizeObserver = ResizeObserver

describe('Map', () => {
  it('creates a map container div on mount', () => {
    const wrapper = mount(Map)
    const mapContainer = wrapper.find('#map')
    expect(mapContainer.exists()).toBe(true)
  })
})
