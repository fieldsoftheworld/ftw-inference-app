import { ref, watch } from 'vue'

import { generateJWT } from '../functions/generate-jwt'

import useAreaOfInterest from './useAreaOfInterest'
import useMap from './useMap'
import useNotifier from './useNotifier'
import useSettings from './useSettings'
import useStacLayer from './useStacLayer'
import { type SearchResult } from './useSearch'

const isProjectLoading = ref(false)
const isProcessing = ref(false)
const projects = ref<Array<string>>([])

export default function useProcessing() {
  const { currentBBox, isBBox } = useAreaOfInterest()
  const { fitMapToBbox, displayGeoJSON } = useMap()
  const { showError, showSuccess, showInfo, showWarning } = useNotifier()
  const { settings, modelIsSingleShot } = useSettings()
  const { stacPreviewTileId } = useStacLayer()

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

  const loadProjectsFromStorage = () => {
    const stored = localStorage.getItem('ftw-projects')
    if (stored) {
      const data = JSON.parse(stored)
      if (Array.isArray(data)) {
        projects.value = data.slice(0)
      }
    }
  }
  loadProjectsFromStorage()

  watch(
    projects,
    (newVal) => {
      localStorage.setItem('ftw-projects', JSON.stringify(newVal))
    },
    { deep: true },
  )

  const wait = (sec = 20) => {
    return new Promise((resolve) => setTimeout(resolve, sec * 1000))
  }

  const createHeaders = () => {
    const token = generateJWT()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }

  const requestUntil = async (fn: () => Promise<Response>): Promise<any> => {
    const response = await fn()
    if (response.status === 503) {
      showInfo('Server is busy. Retrying in 20 seconds...')
      isProcessing.value = false
      await wait(20)
      isProcessing.value = true
      return requestUntil(fn)
    }
    const data = await response.json()
    if (!response.ok) {
      const error = data?.detail || response.statusText
      throw new Error(`Processing failed: ${error}`)
    }
    return data
  }

  const pollUntilComplete = async (projectId: string) => {
    let project: any = null
    let failures = 0
    do {
      await wait(10)
      const statusResponse = await fetch(`${apiBaseUrl}projects/${projectId}`, {
        headers: createHeaders(),
      })
      if (statusResponse.ok) {
        failures = 0
        project = await statusResponse.json()
      } else {
        failures += 1
        console.error(`Failed to fetch project status. Attempt ${failures}.`)
        if (failures >= 5) {
          throw new Error(
            `Monitoring the processing aborted after ${failures} consecutive failed attempts to fetch the project status. The results may still be available later.`,
          )
        }
      }
    } while (project.status === 'queued' || project.status === 'running')

    if (project.status === 'failed') {
      throw new Error('Batch processing failed without giving a specific reason. Please try again.')
    } else if (project.status !== 'completed') {
      throw new Error(`Batch processing resported an unexpected status: ${project.status}`)
    }
    return project
  }

  const validateInputs = (
    bbox?: number[],
    firstTile?: SearchResult | null,
    secondTile?: SearchResult | null,
  ) => {
    if (!isBBox(bbox)) {
      throw new Error('Please provide an area of interest before processing.')
    }

    if (modelIsSingleShot.value) {
      if (!firstTile) {
        throw new Error('Please provide a scene before processing.')
      }
    } else {
      if (!firstTile || !secondTile) {
        throw new Error('Please provide two scenes before processing.')
      }
    }
  }

  const processSmallArea = async (
    firstTile: SearchResult | null,
    secondTile: SearchResult | null,
  ) => {
    try {
      validateInputs(currentBBox.value, firstTile, secondTile)
    } catch (error) {
      showError((error as Error).message)
      return
    }

    isProcessing.value = true
    try {
      const data = await requestUntil(async () => {
        return await fetch(`${apiBaseUrl}example`, {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            inference: {
              model: settings.value.model,
              images: modelIsSingleShot.value
                ? [firstTile?.itemUrl]
                : [firstTile?.itemUrl, secondTile?.itemUrl],
              bbox: currentBBox.value,
            },
            polygons: {
              close_interiors: true,
            },
          }),
        })
      })

      // Display GeoJSON if available
      if (data && data.features && Array.isArray(data.features) && data.features.length > 0) {
        const extent = displayGeoJSON(data)
        // Fit map to bbox only if we have a valid extent
        if (extent) {
          fitMapToBbox(extent)
          if (!settings.value.expertMode) {
            showSuccess('Finished processing, results will be shown on the map.')
          }
        } else {
          // displayGeoJSON returned null, which means no valid features or invalid extent
          showWarning(
            'Processing completed but the extent of the results is empty. Please try again with a different settings.',
          )
        }
      } else {
        showWarning(
          'Processing completed but no valid results were generated. Please try again with a different settings.',
        )
      }

      stacPreviewTileId.value = null
    } catch (error) {
      showError((error as Error)?.message || String(error))
    } finally {
      isProcessing.value = false
    }
  }

  const processBatch = async (
    projectTitle: string,
    firstTile: SearchResult | null,
    secondTile?: SearchResult | null,
  ) => {
    try {
      validateInputs(currentBBox.value, firstTile, secondTile)
    } catch (error) {
      showError((error as Error).message)
      return
    }

    isProcessing.value = true

    try {
      // Create project
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

      const projectData = await requestUntil(async () => {
        return await fetch(`${apiBaseUrl}projects`, {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            title: projectTitle,
          }),
        })
      })

      const projectId = projectData.id
      projects.value.push(projectId)

      // Batch Processing
      showInfo('Project created, starting inference...')
      await requestUntil(async () => {
        return await fetch(`${apiBaseUrl}projects/${projectId}/inference`, {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            model: settings.value.model,
            bbox: currentBBox.value,
            images: modelIsSingleShot.value
              ? [firstTile?.itemUrl]
              : [firstTile?.itemUrl, secondTile?.itemUrl],
          }),
        })
      })
      // Todo: If this fails, we should delete the created project to avoid orphan projects

      let project = await pollUntilComplete(projectId)

      if (!project.results.polygons) {
        showInfo('Inference completed, starting polygonization...')
        await requestUntil(async () => {
          // Create polygonize task
          return await fetch(`${apiBaseUrl}projects/${projectId}/polygons`, {
            method: 'PUT',
            headers: createHeaders(),
            body: JSON.stringify({
              close_interiors: true,
            }),
          })
        })
      }

      showSuccess('Batch processing completed, downloading results for visualization...')

      project = await pollUntilComplete(projectId)

      // Fetch batch processing results
      const resultPolygons = project.results.polygons
      const ftwBaseUrl = import.meta.env.VITE_FTW_INFERENCE_OUTPUT_URL || ''
      const url = resultPolygons.startsWith('http') ? resultPolygons : ftwBaseUrl + resultPolygons
      const data = await requestUntil(async () => {
        return await fetch(url, { headers: createHeaders() })
      })

      if (!Array.isArray(data?.features) || data.features.length === 0) {
        throw new Error(
          'Batch processing completed but no valid results were generated. Please try again with different settings.',
        )
      }

      stacPreviewTileId.value = null

      showInfo(`Downloaded ${data.features.length} field boundaries, visualizing...`)
      const extent = displayGeoJSON(data)
      // Fit map to bbox
      if (extent) {
        fitMapToBbox(extent)
      }
    } catch (error) {
      showError((error as Error)?.message || String(error))
    } finally {
      isProcessing.value = false
    }
  }

  const loadProject = async (id: string) => {
    try {
      isProjectLoading.value = true
      const response = await fetch(`${apiBaseUrl}projects/${id}`, {
        headers: createHeaders()
      })
      const project = await response.json()
      const blob = await fetch(project.results.polygons)
      const polygons = await blob.json()
      polygons.bbox = project.parameters.inference.bbox
      return polygons
    } catch (e) {
      showError((e as Error)?.message || String(e))
    } finally {
      isProjectLoading.value = false
    }
  }

  return {
    isProcessing,
    isProjectLoading,
    processBatch,
    processSmallArea,
    loadProject,
    projects,
  }
}
