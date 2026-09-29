// Builds src/data/best-available.json from the harmonized field data catalog.
// The catalog root carries no extents, so the viewport lookup needs a local index.
// Run: npm run build:best-available

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://data.source.coop/ftw/harmonized-field-data/'
const BROWSE = 'https://source.coop/ftw/harmonized-field-data/'
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/best-available.json')
const CONCURRENCY = 8

async function getJson(url, attempt = 1) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    if (attempt < 3) return getJson(url, attempt + 1)
    throw new Error(`${url}: ${err.message}`)
  }
}

function href(collectionId, relative) {
  return BASE + collectionId + '/' + relative.replace(/^\.\//, '')
}

function describe(collection, id) {
  const bbox = collection.extent?.spatial?.bbox?.[0]
  if (!bbox || bbox.length < 4) throw new Error(`${id}: no spatial extent`)

  const pmtiles = collection.links?.find((l) => l.rel === 'pmtiles')?.href
  if (!pmtiles) throw new Error(`${id}: no pmtiles link`)

  // ch merges its cantons into one latest/ch.pmtiles, so the path carries no year.
  const end = collection.extent?.temporal?.interval?.[0]?.[1]
  const year = Number(pmtiles.match(/year=(\d{4})/)?.[1] ?? end?.slice(0, 4))
  if (!year) throw new Error(`${id}: cannot determine edition year`)

  // ch partitions by canton as well as year, so items outnumber editions.
  const years = new Set(
    (collection.links ?? [])
      .filter((l) => l.rel === 'item')
      .map((l) => l.href.match(/year=(\d{4})/)?.[1])
      .filter(Boolean),
  )

  return {
    id,
    title: collection.title ?? id,
    holds: /^Field blocks for/i.test(collection.title ?? '') ? 'blocks' : 'fields',
    bbox: bbox.slice(0, 4).map((n) => Math.round(n * 1e5) / 1e5),
    year,
    editions: years.size,
    provider:
      collection.providers?.find((p) => p.roles?.includes('producer'))?.name ?? 'Unknown provider',
    license: collection.license ?? 'unknown',
    pmtiles: href(id, pmtiles),
    providerUrl: collection.links?.find((l) => l.rel === 'via')?.href ?? null,
    catalogUrl: BROWSE + id + '/',
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

const root = await getJson(BASE + 'catalog.json')
const ids = (root.links ?? [])
  .filter((l) => l.rel === 'child' && l.href?.endsWith('/collection.json'))
  .map((l) => l.href.replace(/^\.\//, '').replace('/collection.json', ''))

if (ids.length === 0) throw new Error('catalog.json listed no child collections')

const failures = []
const entries = (
  await mapLimit(ids, CONCURRENCY, async (id) => {
    try {
      return describe(await getJson(BASE + id + '/collection.json'), id)
    } catch (err) {
      failures.push(err.message)
      return null
    }
  })
).filter(Boolean)

if (failures.length) {
  console.error(`\n${failures.length} collection(s) could not be indexed:`)
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}

entries.sort((a, b) => a.id.localeCompare(b.id))

await mkdir(dirname(OUT), { recursive: true })
await writeFile(
  OUT,
  JSON.stringify(
    { generated: new Date().toISOString().slice(0, 10), base: BASE, collections: entries },
    null,
    0,
  ) + '\n',
)

const fields = entries.filter((e) => e.holds === 'fields').length
console.log(
  `${entries.length} collections indexed (${fields} fields, ${entries.length - fields} blocks) -> ${OUT}`,
)
