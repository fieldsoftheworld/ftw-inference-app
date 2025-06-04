import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Map from '../Map.vue'

describe('Map', () => {
  it('creates a map container div on mount', () => {
    const wrapper = mount(Map)
    const mapContainer = wrapper.find('#map')
    expect(mapContainer.exists()).toBe(true)
  })
})
