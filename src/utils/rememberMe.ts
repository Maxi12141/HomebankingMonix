const STORAGE_KEY = 'monix_remembered_email'

// Sólo el email — nunca la contraseña. El desbloqueo con huella/Face ID
// usa su propio registro (ver activarBiometria en lib/biometria.ts).
export function getRememberedEmail(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function saveRememberedEmail(email: string) {
  localStorage.setItem(STORAGE_KEY, email)
}

export function clearRememberedEmail() {
  localStorage.removeItem(STORAGE_KEY)
}
