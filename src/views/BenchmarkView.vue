<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { generateJWT } from '../functions/generate-jwt'
import { useBenchmarkCatalog } from '../composables/useBenchmarkCatalog'
import useNotifier from '../composables/useNotifier'
import BenchmarkMap from '../components/BenchmarkMap.vue'
import type { BenchmarkMapChip } from '../components/BenchmarkMap.vue'
import {
  mdiAlertCircle,
  mdiArrowLeft,
  mdiCheckCircle,
  mdiInformationOutline,
  mdiPlay,
} from '@mdi/js'

const base = import.meta.env.VITE_API_BASE_URL || '/v1/'
const { countries, models, loading, error, loadBenchmarkCatalog } = useBenchmarkCatalog()
const { showError, showSuccess } = useNotifier()

const selectedModels = ref<string[]>([])
const selectedCountries = ref<string[]>([])
const split = ref<'train' | 'validation' | 'val' | 'test'>('test')
const maxChips = ref(5)
const includeMapGeojson = ref(true)
const polling = ref(false)
const taskId = ref<string | null>(null)
const taskStatus = ref<string | null>(null)
const result = ref<Record<string, unknown> | null>(null)
const elapsedSec = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null

const canSubmit = computed(
  () =>
    selectedModels.value.length > 0 &&
    selectedCountries.value.length > 0 &&
    !polling.value,
)

/** Human-readable phase label shown while the task is running. */
const phaseLabel = computed(() => {
  if (taskStatus.value === 'queued') return 'Queued…'
  if (taskStatus.value === 'running') {
    // First ~30 s is normally the download phase for uncached datasets.
    return elapsedSec.value < 30
      ? 'Downloading dataset from Source Cooperative…'
      : 'Running inference & scoring…'
  }
  return taskStatus.value ?? ''
})

const autoDownloads = computed<string[]>(() => {
  const r = result.value
  return Array.isArray(r?.auto_downloaded) ? (r!.auto_downloaded as string[]) : []
})

const byModel = computed(() => {
  return (result.value?.by_model ?? null) as Record<string, unknown> | null
})

/** API `note` on a country when chips_evaluated is 0 (STAC/inference/mask issues). */
const mapGeojson = computed(() => {
  const r = result.value
  if (!r || typeof r !== 'object') return null
  const mg = (r as Record<string, unknown>).map_geojson
  if (!mg || typeof mg !== 'object') return null
  return mg as Record<string, Record<string, { chips: unknown[] }>>
})

const mapOmitted = computed(() => {
  const r = result.value as Record<string, unknown> | null
  const o = r?.map_geojson_omitted
  return typeof o === 'string' ? o : null
})

const isDemoResult = computed(() => Boolean(result.value?.demo))

/** True when the API returned a non-empty map_geojson object. */
const hasMapGeojsonPayload = computed(() => {
  const mg = mapGeojson.value
  return Boolean(mg && Object.keys(mg).length > 0)
})

const mapModel = ref<string | null>(null)
const mapCountry = ref<string | null>(null)

const mapModelChoices = computed(() => (mapGeojson.value ? Object.keys(mapGeojson.value) : []))

const mapCountryChoices = computed(() => {
  const m = mapModel.value
  const mg = mapGeojson.value
  if (!m || !mg || !mg[m]) return []
  return Object.keys(mg[m])
})

const currentMapPayload = computed(() => {
  const mg = mapGeojson.value
  const m = mapModel.value
  const c = mapCountry.value
  if (!mg || !m || !c) return null
  const entry = mg[m]?.[c]
  if (!entry?.chips?.length) return null
  return entry as { chips: BenchmarkMapChip[] }
})

watch(
  [mapGeojson, result],
  () => {
    const mg = mapGeojson.value
    if (!mg || !Object.keys(mg).length) {
      mapModel.value = null
      mapCountry.value = null
      return
    }
    const models = Object.keys(mg)
    if (!mapModel.value || !models.includes(mapModel.value)) {
      mapModel.value = models[0] ?? null
    }
    const mids = mapModel.value ? Object.keys(mg[mapModel.value] ?? {}) : []
    if (!mapCountry.value || !mids.includes(mapCountry.value)) {
      mapCountry.value = mids[0] ?? null
    }
  },
  { immediate: true },
)

const benchmarkNotes = computed(() => {
  const out: string[] = []
  const bm = byModel.value
  if (!bm) return out
  for (const [modelId, modelData] of Object.entries(bm)) {
    const countries = (modelData as Record<string, unknown>)?.countries as
      | Record<string, unknown>
      | undefined
    if (!countries) continue
    for (const [cid, cdata] of Object.entries(countries)) {
      const cd = cdata as Record<string, unknown>
      const note = cd?.note
      if (typeof note === 'string' && note.trim()) {
        out.push(`${modelId} · ${String(cd.title ?? cid)}: ${note}`)
      }
    }
  }
  return out
})

/** API map_geojson_note when scores exist but map serialization failed or worker is old. */
const mapGeojsonNotes = computed(() => {
  const out: string[] = []
  const bm = byModel.value
  if (!bm) return out
  for (const [modelId, modelData] of Object.entries(bm)) {
    const countries = (modelData as Record<string, unknown>)?.countries as
      | Record<string, unknown>
      | undefined
    if (!countries) continue
    for (const [, cdata] of Object.entries(countries)) {
      const cd = cdata as Record<string, unknown>
      const n = cd?.map_geojson_note
      if (typeof n === 'string' && n.trim()) {
        out.push(`${modelId} · ${String(cd.title ?? '')}: ${n}`)
      }
    }
  }
  return out
})

onMounted(() => {
  loadBenchmarkCatalog()
})

async function submitRun() {
  result.value = null
  taskId.value = null
  polling.value = true
  taskStatus.value = 'queued'
  elapsedSec.value = 0
  elapsedTimer = setInterval(() => elapsedSec.value++, 1000)

  try {
    const res = await fetch(`${base}benchmarks/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${generateJWT()}`,
      },
      body: JSON.stringify({
        model_ids: selectedModels.value,
        country_ids: selectedCountries.value,
        split: split.value,
        max_chips: maxChips.value,
        iou_threshold: 0.25,
        include_map_geojson: Boolean(includeMapGeojson.value),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Benchmark request failed')
    taskId.value = data.task_id
    // Worker often goes queued → running → completed in under 1s; show progress immediately.
    taskStatus.value = 'running'
    await pollTask(data.task_id)
  } catch (e) {
    showError(e instanceof Error ? e.message : String(e))
  } finally {
    polling.value = false
    if (elapsedTimer) clearInterval(elapsedTimer)
  }
}

async function pollTask(id: string) {
  const headers = { Authorization: `Bearer ${generateJWT()}` }
  for (let i = 0; i < 800; i++) {
    const res = await fetch(`${base}benchmarks/runs/${id}`, { headers })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Poll failed')
    taskStatus.value = data.status
    if (data.status === 'completed') {
      result.value = (data.result as Record<string, unknown>) || null
      showSuccess('Benchmark completed.')
      return
    }
    if (data.status === 'failed') {
      showError(data.error || 'Benchmark failed')
      return
    }
    // Poll quickly at first so the progress UI reflects running before the job finishes.
    const delayMs = i < 60 ? 350 : 2000
    await new Promise((r) => setTimeout(r, delayMs))
  }
  showError('Timed out waiting for benchmark. The job may still run server-side.')
}
</script>

<template>
  <div class="benchmark-view">
    <header class="bar">
      <RouterLink to="/" class="back" :title="'Map'">
        <v-icon :icon="mdiArrowLeft" size="small" class="mr-1" />
        Map
      </RouterLink>
      <span class="title">FTW benchmark evaluation</span>
    </header>

    <v-container class="py-6" max-width="960">
      <p class="text-body-2 mb-2">
        Select models and countries. <strong>Real scores</strong> need the full FTW benchmark tree on
        the API host (<code>BENCHMARK__DATA_ROOT</code>): chips GeoParquet, <code>data_config</code>
        (STAC URLs), and <code>label_masks/instance/</code> per country.
      </p>
      <p class="text-caption text-medium-emphasis mb-6">
        With <code>BENCHMARK__AUTO_DOWNLOAD=true</code>, the API looks for
        <code>chips_{country}.parquet</code> on Source Cooperative (not the older
        <code>boundaries_*</code>-only drops). You still need STAC URLs and label masks for a full run.
        Use <code>BENCHMARK__ALLOW_DEMO=true</code> for placeholder scores without data.
        Runs are <strong>sequential per chip</strong> (download + inference + scoring); tens of seconds
        to a few minutes per chip is normal. Matching uses a default IoU of <strong>0.25</strong> because
        auto-picked Sentinel scenes are not the benchmark’s original imagery (overlaps are often &lt;0.5).
      </p>

      <v-alert v-if="error" type="warning" class="mb-4" density="compact">{{ error }}</v-alert>
      <v-progress-linear v-if="loading" indeterminate class="mb-4" />

      <v-row>
        <v-col cols="12" md="6">
          <v-select
            v-model="selectedModels"
            :items="models"
            item-title="title"
            item-value="id"
            label="Models"
            multiple
            chips
            closable-chips
            :disabled="loading || polling"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-select
            v-model="selectedCountries"
            :items="countries"
            item-title="title"
            item-value="id"
            label="Countries"
            multiple
            chips
            closable-chips
            :disabled="loading || polling"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="split"
            :items="[
              { title: 'Test', value: 'test' },
              { title: 'Validation', value: 'validation' },
              { title: 'Train', value: 'train' },
            ]"
            label="Split"
            :disabled="loading || polling"
          >
            <template #append-inner>
              <v-tooltip location="bottom" max-width="340" :open-delay="200" :close-delay="100">
                <template #activator="{ props: tipProps }">
                  <v-icon
                    v-bind="tipProps"
                    :icon="mdiInformationOutline"
                    size="small"
                    class="split-info-icon"
                    aria-label="About chip split"
                  />
                </template>
                <div class="text-caption text-medium-emphasis">
                  Chips GeoParquet often has a <code>split</code> column. This choice keeps only rows
                  in that partition, then <code>max chips</code> is applied.
                  <strong class="text-high-emphasis">Test</strong> — held-out set (usual benchmark).
                  <strong class="text-high-emphasis">Validation</strong> — validation fold.
                  <strong class="text-high-emphasis">Train</strong> — training chips (not unbiased
                  generalization). If the file has no split column, this setting has no effect.
                </div>
              </v-tooltip>
            </template>
          </v-select>
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model.number="maxChips"
            type="number"
            label="Max chips / country / model"
            min="1"
            max="500"
            :disabled="loading || polling"
          />
        </v-col>
        <v-col cols="12" md="4" class="d-flex flex-column justify-center gap-1">
          <v-checkbox
            v-model="includeMapGeojson"
            label="Include map (GT vs predictions)"
            density="compact"
            hide-details
            :disabled="loading || polling"
          />
          <v-btn
            color="primary"
            :prepend-icon="mdiPlay"
            :disabled="!canSubmit || loading"
            :loading="polling"
            @click="submitRun"
          >
            Run benchmark
          </v-btn>
        </v-col>
      </v-row>

      <!-- ── Progress card (shown while task is active) ── -->
      <v-card v-if="taskId && polling" class="mt-6" variant="outlined">
        <v-card-text class="py-4">
          <v-progress-linear indeterminate color="primary" rounded height="6" class="mb-3" />
          <div class="d-flex align-center">
            <span class="text-body-2 text-medium-emphasis">{{ phaseLabel }}</span>
            <span class="text-caption text-disabled ml-auto">{{ elapsedSec }}s</span>
          </div>
          <div class="text-caption text-disabled mt-1">Task {{ taskId }}</div>
        </v-card-text>
      </v-card>

      <!-- ── Results card ── -->
      <v-card v-if="result && !polling" class="mt-6" variant="outlined">
        <v-card-title class="text-subtitle-1 pb-0">Results</v-card-title>
        <v-card-text>
          <!-- Download notice -->
          <v-alert
            v-if="autoDownloads.length"
            type="info"
            density="compact"
            class="mb-4"
            :prepend-icon="mdiCheckCircle"
          >
            Auto-downloaded from Source Cooperative:
            <ul class="mt-1 pl-4">
              <li v-for="d in autoDownloads" :key="d">{{ d }}</li>
            </ul>
          </v-alert>

          <v-alert
            v-if="benchmarkNotes.length"
            type="warning"
            density="compact"
            class="mb-4"
            :prepend-icon="mdiAlertCircle"
          >
            <div class="text-caption text-medium-emphasis mb-1">Why scores can be all zero</div>
            <ul class="mt-1 pl-4 text-body-2">
              <li v-for="(n, idx) in benchmarkNotes" :key="idx">{{ n }}</li>
            </ul>
          </v-alert>

          <v-alert
            v-if="mapGeojsonNotes.length"
            type="warning"
            density="compact"
            class="mb-4"
            :prepend-icon="mdiAlertCircle"
          >
            <div class="text-caption text-medium-emphasis mb-1">Map (GeoJSON)</div>
            <ul class="mt-1 pl-4 text-body-2">
              <li v-for="(n, idx) in mapGeojsonNotes" :key="'m' + idx">{{ n }}</li>
            </ul>
          </v-alert>

          <!-- Demo mode notice -->
          <v-alert
            v-if="result.demo"
            type="warning"
            density="compact"
            class="mb-4"
            :prepend-icon="mdiAlertCircle"
          >
            {{ result.message }}
          </v-alert>

          <!-- Per-model score tables -->
          <template v-if="byModel">
            <div v-for="(modelData, modelId) in byModel" :key="String(modelId)" class="mb-6">
              <div class="text-subtitle-2 mb-2">Model: {{ modelId }}</div>
              <v-table density="compact">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Chips</th>
                    <th>Finding fields</th>
                    <th>Not finding non-fields</th>
                    <th>Correct size &amp; shape</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(cd, cid) in (modelData as Record<string,unknown>).countries as Record<string,unknown>"
                    :key="String(cid)"
                  >
                    <td>{{ (cd as Record<string,unknown>).title ?? cid }}</td>
                    <td>{{ (cd as Record<string,unknown>).chips_evaluated }}</td>
                    <td>{{ ((cd as Record<string,unknown>).scores as Record<string,number>).finding_fields }}</td>
                    <td>{{ ((cd as Record<string,unknown>).scores as Record<string,number>).not_finding_non_fields }}</td>
                    <td>{{ ((cd as Record<string,unknown>).scores as Record<string,number>).correct_sizes_and_shapes }}</td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </template>

          <!-- Map: chip footprints + ground truth (green) vs predictions (blue) -->
          <v-divider class="my-6" />
          <div class="text-subtitle-2 mb-1">Benchmark map</div>
          <p class="text-caption text-medium-emphasis mb-4">
            Gold outline = chip footprint; green = ground truth; blue = model predictions. Requires a
            deployed API that returns <code>map_geojson</code> and at least one scored chip.
          </p>

          <v-alert
            v-if="isDemoResult"
            type="info"
            density="compact"
            class="mb-2"
            variant="tonal"
            :prepend-icon="mdiInformationOutline"
          >
            Demo / placeholder runs do not include chip geometries — mount real FTW data and disable
            demo mode to see a map.
          </v-alert>
          <v-alert
            v-else-if="mapOmitted"
            type="info"
            density="compact"
            class="mb-2"
            variant="tonal"
            :prepend-icon="mdiInformationOutline"
          >
            {{ mapOmitted }}
          </v-alert>
          <template v-else-if="hasMapGeojsonPayload && mapModelChoices.length">
            <v-row class="mb-2">
              <v-col cols="12" md="6">
                <v-select
                  v-model="mapModel"
                  :items="mapModelChoices"
                  label="Model"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="mapCountry"
                  :items="mapCountryChoices"
                  label="Country"
                  density="compact"
                  hide-details
                />
              </v-col>
            </v-row>
            <BenchmarkMap :map-data="currentMapPayload" />
          </template>
          <p v-else class="text-body-2 text-medium-emphasis">
            No map layers in this response. If <strong>Chips</strong> is above zero, open
            <span class="text-caption text-disabled">Raw JSON</span> and confirm a top-level
            <code>map_geojson</code> object. If it is missing, restart the API after updating to a build
            that includes map support. Also check <strong>Include map</strong> is on,
            <code>max_chips</code> ≤ 40, and see the “Map (GeoJSON)” note above if any.
          </p>

          <!-- Raw JSON fallback -->
          <details class="mt-4">
            <summary class="text-caption text-disabled" style="cursor: pointer">Raw JSON</summary>
            <pre class="result-json">{{ JSON.stringify(result, null, 2) }}</pre>
          </details>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<style scoped>
/* App uses html/body overflow:hidden for the map view; this route must scroll inside #app. */
.benchmark-view {
  box-sizing: border-box;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #121212;
  color: #eee;
}
.bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.5);
}
.back {
  color: #90caf9;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
.title {
  font-weight: 600;
  font-size: 1.15rem;
}
.split-info-icon {
  cursor: help;
  opacity: 0.8;
}
.result-json {
  margin-top: 0.5rem;
  padding: 1rem;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: auto;
  font-size: 0.8rem;
}
</style>
