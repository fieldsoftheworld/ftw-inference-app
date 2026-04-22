import { describe, expect, it } from 'vitest'
import {
  buildGlobalPermalinkParts,
  parsePermalinkHash,
  type PermalinkStateGlobal,
} from '../usePermalink'
import useSettings from '../useSettings'

const availableModes = [
  { id: 'global', label: 'Global Predictions' },
  { id: 'inference', label: 'My Inference' },
]

describe('buildGlobalPermalinkParts', () => {
  it('serializes global settings including downloads', () => {
    const { defaultSettings } = useSettings()
    const parts = buildGlobalPermalinkParts({
      ...defaultSettings,
      mode: 'global',
      threshold: 0.65,
      year: 2024,
      opacity: 55,
      downloads: true,
    })

    expect(parts).toEqual(['threshold:0.65', 'year:2024', 'opacity:55', 'downloads:1'])
  })
})

describe('parsePermalinkHash', () => {
  it('returns null when no permalink hash is present', () => {
    expect(parsePermalinkHash('', 'global', availableModes)).toBeNull()
  })

  it('restores global downloads visibility from the hash', () => {
    const state = parsePermalinkHash(
      '#map=3.00/12.0000/48.0000/mode:global/threshold:0.8/year:2025/opacity:72/downloads:1',
      'global',
      availableModes,
    ) as PermalinkStateGlobal

    expect(state.mode).toBe('global')
    expect(state.threshold).toBe(0.8)
    expect(state.year).toBe(2025)
    expect(state.opacity).toBe(72)
    expect(state.downloads).toBe(true)
  })

  it('defaults global downloads visibility to false when absent', () => {
    const state = parsePermalinkHash(
      '#map=3.00/12.0000/48.0000/mode:global/threshold:0.8/year:2025/opacity:72',
      'global',
      availableModes,
    ) as PermalinkStateGlobal

    expect(state.downloads).toBe(false)
  })
})
