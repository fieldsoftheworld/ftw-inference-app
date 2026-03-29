import { ref, shallowRef } from 'vue'
import { generateJWT } from '../functions/generate-jwt'

const base = import.meta.env.VITE_API_BASE_URL || '/v1/'

export interface BenchmarkCountry {
  id: string
  title: string
  year: number
  chips: number
  train: number
  validation: number
  test: number
  license: string
}

export interface ModelRow {
  id: string
  title: string
  description?: string
}

const countries = shallowRef<BenchmarkCountry[]>([])
const models = shallowRef<ModelRow[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export async function loadBenchmarkCatalog(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const headers = {
      Authorization: `Bearer ${generateJWT()}`,
    }
    const [cRes, mRes] = await Promise.all([
      fetch(`${base}benchmarks/countries`, { headers }),
      fetch(`${base}models`, { headers }),
    ])
    if (!cRes.ok) {
      throw new Error((await cRes.json()).detail || 'Failed to load benchmarks')
    }
    if (!mRes.ok) {
      throw new Error((await mRes.json()).detail || 'Failed to load models')
    }
    const cJson = await cRes.json()
    const mJson = await mRes.json()
    countries.value = cJson.countries || []
    models.value = mJson.models || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

export function useBenchmarkCatalog() {
  return {
    countries,
    models,
    loading,
    error,
    loadBenchmarkCatalog,
  }
}
