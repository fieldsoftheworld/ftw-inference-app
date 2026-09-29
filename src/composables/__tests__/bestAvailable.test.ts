import { describe, it, expect } from 'vitest'
import { attributionFor, colorFor, PALETTE } from '../../layers/Best-Available-Layer'
import type { BestAvailableCollection } from '../useBestAvailable'
import index from '../../data/best-available.json'

const collections = index.collections as BestAvailableCollection[]

const sample: BestAvailableCollection = {
  id: 'nl',
  title: 'BRP Crop Field Boundaries for The Netherlands (CAP-based)',
  holds: 'fields',
  bbox: [3.25755, 50.73427, 7.23806, 53.49476],
  year: 2026,
  editions: 18,
  provider: 'RVO / PDOK',
  license: 'CC0-1.0',
  pmtiles: 'https://example.org/nl-2026.pmtiles',
  providerUrl: 'https://www.pdok.nl/',
  catalogUrl: 'https://source.coop/ftw/harmonized-field-data/nl/',
}

describe('colorFor', () => {
  it('cycles the palette so any position gets a colour', () => {
    expect(colorFor(0)).toBe(PALETTE[0])
    expect(colorFor(PALETTE.length)).toBe(PALETTE[0])
    expect(colorFor(PALETTE.length + 3)).toBe(PALETTE[3])
  })
})

describe('attributionFor', () => {
  it('links the provider and names the licence', () => {
    expect(attributionFor(sample)).toBe(
      '<a href="https://www.pdok.nl/" target="_blank" rel="noopener">RVO / PDOK</a> (CC0-1.0)',
    )
  })

  it('escapes provider names that carry HTML characters', () => {
    const amp = { ...sample, provider: 'Agentschap Landbouw & Zeevisserij' }
    expect(attributionFor(amp)).toContain('Landbouw &amp; Zeevisserij')
    expect(attributionFor(amp)).not.toContain('Landbouw & Zeevisserij<')
  })

  it('falls back to plain text when the provider has no URL', () => {
    expect(attributionFor({ ...sample, providerUrl: null })).toBe('RVO / PDOK (CC0-1.0)')
  })
})

describe('the generated index', () => {
  it('has a unique id per collection', () => {
    expect(new Set(collections.map((c) => c.id)).size).toBe(collections.length)
  })

  it('gives every collection a well-formed lon/lat bbox', () => {
    for (const c of collections) {
      expect(c.bbox).toHaveLength(4)
      expect(c.bbox[0]).toBeLessThan(c.bbox[2])
      expect(c.bbox[1]).toBeLessThan(c.bbox[3])
      expect(Math.abs(c.bbox[0])).toBeLessThanOrEqual(180)
      expect(Math.abs(c.bbox[1])).toBeLessThanOrEqual(90)
    }
  })

  it('points every PMTiles and catalog link at https', () => {
    for (const c of collections) {
      expect(c.pmtiles.startsWith('https://')).toBe(true)
      expect(c.catalogUrl.startsWith('https://')).toBe(true)
    }
  })

  it('marks blocks separately from crop fields', () => {
    const blocks = collections.filter((c) => c.holds === 'blocks')
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.every((c) => /^Field blocks for/i.test(c.title))).toBe(true)
  })
})
