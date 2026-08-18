const STORAGE_KEY = 'monix_remembered_credentials'

interface RememberedCredentials {
  email: string
  password: string
}

export function getRememberedCredentials(): RememberedCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RememberedCredentials
  } catch {
    return null
  }
}

export function saveRememberedCredentials(email: string, password: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, password }))
}

export function clearRememberedCredentials() {
  localStorage.removeItem(STORAGE_KEY)
}
