export const formatMeasurementDisplay = (value: number, key: string) => {
  if (typeof value !== 'number') return value

  if (key === 'area') {
    return `${value.toFixed(2)} ha`
  }

  return `${value.toFixed(2)} km`
}
