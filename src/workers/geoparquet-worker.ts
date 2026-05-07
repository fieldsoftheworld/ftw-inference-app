import { asyncBufferFromUrl, parquetMetadataAsync, parquetRead } from 'hyparquet'
// We don't need hyperquet-compressors as the files are Snappy compressed, which is supported natively by hyparquet

export interface GeoParquetWorkerRequest {
  url: string
}

export type GeoParquetWorkerResponse =
  | { type: 'done'; buffer: ArrayBuffer }
  | { type: 'error'; message: string }

self.onmessage = async (event: MessageEvent<GeoParquetWorkerRequest>) => {
  const { url } = event.data
  try {
    const file = await asyncBufferFromUrl({ url })
    const metadata = await parquetMetadataAsync(file)

    // Determine geometry column from GeoParquet metadata
    let geometryColumn = 'geometry'
    const geoMetaEntry = metadata.key_value_metadata?.find((kv) => kv.key === 'geo')
    if (geoMetaEntry?.value) {
      try {
        const geoMeta = JSON.parse(geoMetaEntry.value) as { primary_column?: string }
        geometryColumn = geoMeta.primary_column ?? 'geometry'
      } catch {
        // use default 'geometry'
      }
    }

    // Collect JSON feature strings incrementally to avoid a large intermediate join
    const featureParts: string[] = []

    await parquetRead({
      file,
      metadata,
      rowFormat: 'object',
      onComplete(rows: Record<string, unknown>[]) {
        for (const row of rows) {
          const geometry = row[geometryColumn]
          const properties: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(row)) {
            if (key !== geometryColumn) properties[key] = value
          }
          featureParts.push(JSON.stringify({ type: 'Feature', geometry, properties }))
        }
      },
    })

    // Assemble FeatureCollection – pass an array to Blob to avoid one giant string concat
    const blobParts: string[] = ['{"type":"FeatureCollection","features":[']
    for (let i = 0; i < featureParts.length; i++) {
      if (i > 0) blobParts.push(',')
      blobParts.push(featureParts[i])
    }
    blobParts.push(']}')

    const blob = new Blob(blobParts, { type: 'application/geo+json' })
    const buffer = await blob.arrayBuffer()

    self.postMessage({ type: 'done', buffer } satisfies GeoParquetWorkerResponse, {
      transfer: [buffer],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    self.postMessage({ type: 'error', message } satisfies GeoParquetWorkerResponse)
  }
}
