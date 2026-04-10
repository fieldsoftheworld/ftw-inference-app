import { computed, ref } from 'vue'
import useNotifier from './useNotifier'
import { generateJWT } from '../functions/generate-jwt'

export type ContributionType = 'annotator' | 'share_data' | 'provide_models' | 'contribute_code'

export interface ContributeForm {
  contributionTypes: ContributionType[]
  resourceLink: string
  additionalInfo: string
  name: string
  email: string
  organization: string
}

const CONTRIBUTION_OPTIONS: Array<{ value: ContributionType; label: string; description: string }> =
  [
    {
      value: 'annotator',
      label: 'Become an annotator',
      description: 'Help label/annotate field boundaries',
    },
    {
      value: 'share_data',
      label: 'Share data',
      description: 'Share existing field boundary datasets',
    },
    {
      value: 'provide_models',
      label: 'Provide models',
      description: 'Contribute trained ML models',
    },
    {
      value: 'contribute_code',
      label: 'Contribute to the codebase',
      description: 'Contribute to FTW software repositories',
    },
  ]

function isValidEmail(email: string) {
  if (!email) {
    return true
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

function validateMaxLength(value: string, max: number): boolean {
  return value.length <= max
}

function validateMinLength(value: string, min: number): boolean {
  return value.length >= min
}

function validateFormData(form: ContributeForm): string | null {
  const name = form.name.trim()
  const email = form.email.trim()
  const resourceLink = form.resourceLink.trim()
  const additionalInfo = form.additionalInfo.trim()
  const organization = form.organization.trim()

  if (!validateMinLength(name, 1)) {
    return 'Name must be at least 1 character.'
  }
  if (!validateMaxLength(name, 200)) {
    return 'Name must not exceed 200 characters.'
  }
  if (!validateMaxLength(email, 254)) {
    return 'Email must not exceed 254 characters.'
  }
  if (resourceLink && !validateMaxLength(resourceLink, 1000)) {
    return 'Resource link must not exceed 1000 characters.'
  }
  if (additionalInfo && !validateMaxLength(additionalInfo, 5000)) {
    return 'Additional info must not exceed 5000 characters.'
  }
  if (organization && !validateMaxLength(organization, 200)) {
    return 'Organization must not exceed 200 characters.'
  }

  return null
}

function getContributeEndpoint() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  return `${baseUrl}feedback/contribute`
}

export default function useGlobalContribute() {
  const { showError, showSuccess } = useNotifier()
  const contributeEndpoint = getContributeEndpoint()

  const contributeDialogOpen = ref(false)
  const isSubmitting = ref(false)

  const contributeForm = ref<ContributeForm>({
    contributionTypes: [],
    resourceLink: '',
    additionalInfo: '',
    name: '',
    email: '',
    organization: '',
  })

  const canSubmit = computed(() => {
    if (
      contributeForm.value.contributionTypes.length === 0 ||
      contributeForm.value.name.trim() === '' ||
      !isValidEmail(contributeForm.value.email.trim())
    ) {
      return false
    }

    const validationError = validateFormData(contributeForm.value)
    return validationError === null
  })

  const openContributeDialog = () => {
    contributeDialogOpen.value = true
  }

  const closeContributeDialog = () => {
    contributeDialogOpen.value = false
  }

  const resetContributeForm = () => {
    contributeForm.value = {
      contributionTypes: [],
      resourceLink: '',
      additionalInfo: '',
      name: '',
      email: '',
      organization: '',
    }
  }

  const postToEndpoint = async (url: string, payload: Record<string, unknown>) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${generateJWT()}`,
      },
      body: JSON.stringify(payload),
    })

    let data: any = null
    try {
      data = await response.json()
    } catch {
      data = null
    }

    if (!response.ok) {
      const errorMessage = data?.detail || data?.message || response.statusText || 'Submit failed'
      throw new Error(errorMessage)
    }

    return data
  }

  const submitContribute = async () => {
    if (!canSubmit.value) {
      showError('Please fill in all required fields.')
      return
    }

    const validationError = validateFormData(contributeForm.value)
    if (validationError) {
      showError(validationError)
      return
    }

    isSubmitting.value = true
    try {
      const payload: Record<string, unknown> = {
        contribution_types: contributeForm.value.contributionTypes,
        name: contributeForm.value.name.trim(),
        email: contributeForm.value.email.trim(),
      }

      if (contributeForm.value.resourceLink.trim()) {
        payload.resource_link = contributeForm.value.resourceLink.trim()
      }
      if (contributeForm.value.additionalInfo.trim()) {
        payload.additional_info = contributeForm.value.additionalInfo.trim()
      }
      if (contributeForm.value.organization.trim()) {
        payload.organization = contributeForm.value.organization.trim()
      }

      await postToEndpoint(contributeEndpoint, payload)
      showSuccess('Thank you for contributing! We will be in touch.')
      closeContributeDialog()
      resetContributeForm()
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to submit contribution.')
    } finally {
      isSubmitting.value = false
    }
  }

  const updateFormField = (field: keyof ContributeForm, value: any) => {
    contributeForm.value[field] = value
  }

  return {
    CONTRIBUTION_OPTIONS,
    contributeDialogOpen,
    contributeForm,
    canSubmit,
    isSubmitting,
    openContributeDialog,
    closeContributeDialog,
    submitContribute,
    updateFormField,
  }
}
