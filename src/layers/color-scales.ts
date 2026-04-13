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
  { value: 0, color: '#d7191c', label: '0' },
  { value: 0.25, color: '#fec379', label: '25' },
  { value: 0.5, color: '#f3fabb', label: '50' },
  { value: 0.75, color: '#cfecb0', label: '75' },
  { value: 1, color: '#33a02c', label: '100' },
]

export const confidenceColorScale: ColorStop[] = [
  { value: 0, color: '#d7191c', label: '0' },
  { value: 0.4, color: '#fec379', label: '40' },
  { value: 0.45, color: '#f3fabb', label: '45' },
  { value: 0.5, color: '#cfecb0', label: '50' },
  { value: 0.58, color: '#33a02c', label: '58' },
]

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

export function getColorForValue(colorScale: ColorStop[], value: number, alpha = 1): string {
  const first = colorScale[0]
  const last = colorScale[colorScale.length - 1]
  let hex: string
  if (value <= first.value) {
    hex = first.color
  } else if (value >= last.value) {
    hex = last.color
  } else {
    hex = last.color
    for (let i = 0; i < colorScale.length - 1; i++) {
      if (value <= colorScale[i + 1].value) {
        const t = (value - colorScale[i].value) / (colorScale[i + 1].value - colorScale[i].value)
        const [r1, g1, b1] = hexToRgb(colorScale[i].color)
        const [r2, g2, b2] = hexToRgb(colorScale[i + 1].color)
        const r = Math.round(r1 + (r2 - r1) * t)
        const g = Math.round(g1 + (g2 - g1) * t)
        const b = Math.round(b1 + (b2 - b1) * t)
        hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        break
      }
    }
  }
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
