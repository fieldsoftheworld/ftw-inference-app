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

export const globalPredictionsStyle: FeatureStyle = {
  fill: 'rgba(255, 100, 0, 0.2)',
  stroke: 'rgba(255, 100, 0, 0.8)',
  label: 'Global Predictions',
}

export const inferenceStyle: FeatureStyle = {
  fill: 'rgba(0, 255, 255, 0.1)',
  stroke: 'rgba(0, 255, 255, 0.8)',
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
