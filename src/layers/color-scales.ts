export interface ColorStop {
  value: number
  color: string
  label: string
}

export interface FeatureStyle {
  fill: string
  stroke: string
  label: string
}

export const inferenceStyle: FeatureStyle = {
  fill: 'rgba(0, 255, 255, 0.1)',
  stroke: 'rgba(0, 255, 255, 1)',
  label: 'Inference',
}

export const areaColorScale: ColorStop[] = [
  { value: 0, color: '#ff00ee', label: '0' },
  { value: 1, color: '#00ff00', label: '100' },
]

export const CONFIDENCE_MAX = 0.58

export const confidenceColorScale: ColorStop[] = [
  { value: 0, color: '#d7191c', label: '0' },
  { value: 0.4, color: '#fec379', label: '69' },
  { value: 0.45, color: '#f3fabb', label: '78' },
  { value: 0.5, color: '#cfecb0', label: '86' },
  { value: 0.58, color: '#33a02c', label: '100' },
]

const LUT_SIZE = 256

interface PrecomputedScale {
  lut: Uint8Array
  firstValue: number
  rangeInv: number
}

const scaleCache = new Map<ColorStop[], PrecomputedScale>()

function precomputeScale(colorScale: ColorStop[]): PrecomputedScale {
  const n = colorScale.length
  const stopValues = new Float64Array(n)
  const stopR = new Uint8Array(n)
  const stopG = new Uint8Array(n)
  const stopB = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const hex = colorScale[i].color
    stopValues[i] = colorScale[i].value
    stopR[i] = parseInt(hex.slice(1, 3), 16)
    stopG[i] = parseInt(hex.slice(3, 5), 16)
    stopB[i] = parseInt(hex.slice(5, 7), 16)
  }

  const firstValue = stopValues[0]
  const range = stopValues[n - 1] - firstValue
  const lut = new Uint8Array(LUT_SIZE * 3)

  for (let i = 0; i < LUT_SIZE; i++) {
    const value = firstValue + (i / (LUT_SIZE - 1)) * range
    const offset = i * 3

    let lo = 0
    let hi = n - 1
    if (value <= stopValues[0]) {
      lo = hi = 0
    } else if (value >= stopValues[n - 1]) {
      lo = hi = n - 1
    } else {
      for (let j = 0; j < n - 1; j++) {
        if (value <= stopValues[j + 1]) {
          lo = j
          hi = j + 1
          break
        }
      }
    }

    if (lo === hi) {
      lut[offset] = stopR[lo]
      lut[offset + 1] = stopG[lo]
      lut[offset + 2] = stopB[lo]
    } else {
      const t = (value - stopValues[lo]) / (stopValues[hi] - stopValues[lo])
      lut[offset] = Math.round(stopR[lo] + (stopR[hi] - stopR[lo]) * t)
      lut[offset + 1] = Math.round(stopG[lo] + (stopG[hi] - stopG[lo]) * t)
      lut[offset + 2] = Math.round(stopB[lo] + (stopB[hi] - stopB[lo]) * t)
    }
  }

  return { lut, firstValue, rangeInv: (LUT_SIZE - 1) / range }
}

function getPrecomputed(colorScale: ColorStop[]): PrecomputedScale {
  let cached = scaleCache.get(colorScale)
  if (!cached) {
    cached = precomputeScale(colorScale)
    scaleCache.set(colorScale, cached)
  }
  return cached
}

export function getColorForValue(colorScale: ColorStop[], value: number, alpha = 1): string {
  const { lut, firstValue, rangeInv } = getPrecomputed(colorScale)
  const idx = Math.min(Math.max(Math.round((value - firstValue) * rangeInv), 0), LUT_SIZE - 1) * 3
  return `rgba(${lut[idx]}, ${lut[idx + 1]}, ${lut[idx + 2]}, ${alpha})`
}
