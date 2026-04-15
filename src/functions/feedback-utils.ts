import { generateJWT } from './generate-jwt'

export const FEEDBACK_FORM_DATA_KEY = 'ftw-feedback-form-data'

export interface PersonalDetails {
  name: string
  email: string
  organization: string
}

export function isValidEmail(email: string): boolean {
  if (!email) {
    return true
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

export function loadPersonalDetails(): PersonalDetails {
  const details: PersonalDetails = { name: '', email: '', organization: '' }
  try {
    const stored = localStorage.getItem(FEEDBACK_FORM_DATA_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      details.name = parsed.name || ''
      details.email = parsed.email || ''
      details.organization = parsed.organization || ''
    }
  } catch (error) {
    console.error('Failed to parse stored form data:', error)
  }
  return details
}

export function savePersonalDetails(details: PersonalDetails): void {
  try {
    localStorage.setItem(
      FEEDBACK_FORM_DATA_KEY,
      JSON.stringify({
        name: details.name,
        email: details.email,
        organization: details.organization,
      }),
    )
  } catch (error) {
    console.error('Failed to save form data to localStorage:', error)
  }
}

export async function postToEndpoint(
  url: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${generateJWT()}`,
    },
    body: JSON.stringify(payload),
  })

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const err = data as Record<string, unknown> | null
    const errorMessage = err?.detail || err?.message || response.statusText || 'Submit failed'
    throw new Error(String(errorMessage))
  }

  return data
}
