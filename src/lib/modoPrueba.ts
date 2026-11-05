import type { User } from '@supabase/supabase-js'
import type { Cuenta, Persona } from '../types'
import { marcarUsuarioNuevo, descartarOnboarding } from './onboarding'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useCuentaStore } from '../store/cuentaStore'
import { CUENTA_PRUEBA_ARS_ID, CUENTA_PRUEBA_USD_ID, SALDO_INICIAL_ARS, SALDO_INICIAL_USD, TASA_PRUEBA_ARS, TASA_PRUEBA_USD, type EstadoPrueba } from '../utils/bancoSimulado'

export { CUENTA_PRUEBA_ARS_ID, CUENTA_PRUEBA_USD_ID }

const MODO_PRUEBA_KEY = 'monix_modo_prueba'
const MOSTRAR_SALDO_KEY = 'monix_mostrar_saldo'
export const ESTADO_PRUEBA_KEY = 'monix_prueba_estado'

export const USUARIO_PRUEBA_ID = '00000000-0000-4000-8000-000000000001'

export function esModoPrueba() {
  try {
    return sessionStorage.getItem(MODO_PRUEBA_KEY) === '1'
  } catch {
    return false
  }
}

export function hace(dias: number, horas: number) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  d.setHours(horas, 12, 0, 0)
  return d.toISOString()
}

function usuarioPrueba(): User {
  return {
    id: USUARIO_PRUEBA_ID,
    email: 'prueba@monix.app',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: hace(0, 9),
  } as User
}

function personaPrueba(): Persona {
  return {
    id: USUARIO_PRUEBA_ID,
    nombre: 'Alex',
    apellido: 'Romero',
    dni: '40111222',
    direccion: 'Av. Corrientes 1234',
    email: 'prueba@monix.app',
    telefono: '11 5555-0101',
    fecha_nac: '1998-04-12',
    sueldo_acreditado: true,
    ingreso_mensual: 850_000,
    situacion_crediticia_monix: 1,
    situacion_informada_at: hace(0, 9),
    created_at: hace(0, 9),
  }
}

function cuentasPrueba(): Cuenta[] {
  const alta = hace(0, 9)
  const estado = leerEstadoPrueba()
  const saldoArs = estado?.saldoArs ?? SALDO_INICIAL_ARS
  const saldoUsd = estado?.saldoUsd ?? SALDO_INICIAL_USD
  const ars: Cuenta = {
    id: CUENTA_PRUEBA_ARS_ID,
    persona_id: USUARIO_PRUEBA_ID,
    numero_cuenta: '0001842201',
    tipo: 'caja_ahorro',
    moneda: 'ARS',
    saldo: saldoArs,
    activa: true,
    cbu: '0000003100098765432101',
    alias: 'alex.romero.monix',
    tasa_anual: TASA_PRUEBA_ARS,
    ultima_interes_at: alta,
    created_at: alta,
  }
  const usd: Cuenta = {
    id: CUENTA_PRUEBA_USD_ID,
    persona_id: USUARIO_PRUEBA_ID,
    numero_cuenta: '0001842202',
    tipo: 'caja_ahorro',
    moneda: 'USD',
    saldo: saldoUsd,
    activa: true,
    cbu: '0000003100098765432102',
    alias: 'alex.romero.usd',
    tasa_anual: TASA_PRUEBA_USD,
    ultima_interes_at: alta,
    created_at: alta,
  }
  return [ars, usd]
}

// Sobrevive a una recarga, y se pierde al salir de la prueba o cerrar la pestaña:
// nada de esto va a localStorage ni a la base. Sin sessionStorage tampoco hay modo prueba
// (esModoPrueba). Los datos de ejemplo están en estadoPrueba.ts, fuera de la carga inicial.
export function leerEstadoPrueba(): EstadoPrueba | null {
  try {
    const guardado = sessionStorage.getItem(ESTADO_PRUEBA_KEY)
    return guardado ? (JSON.parse(guardado) as EstadoPrueba) : null
  } catch {
    return null
  }
}

/** Arma la sesión ficticia. `reiniciarTour` vuelve a mostrar el bono y el tutorial. */
export function entrarModoPrueba(opts?: { reiniciarTour?: boolean }) {
  sessionStorage.setItem(MODO_PRUEBA_KEY, '1')
  // Escanear el QR de nuevo arranca de cero.
  if (opts?.reiniciarTour) sessionStorage.removeItem(ESTADO_PRUEBA_KEY)
  const auth = useAuthStore.getState()
  if (auth.user?.id !== USUARIO_PRUEBA_ID) {
    auth.setUser(usuarioPrueba())
    auth.setPersona(personaPrueba())
  }
  auth.setLoading(false)

  const cuentas = cuentasPrueba()
  const store = useCuentaStore.getState()
  if (opts?.reiniciarTour || !store.cuentasLoaded || store.cuenta?.id !== CUENTA_PRUEBA_ARS_ID) {
    store.setCuentas(cuentas)
    store.setCuenta(cuentas[0])
    store.setCuentasLoaded(true)
  }

  if (opts?.reiniciarTour) {
    marcarUsuarioNuevo(USUARIO_PRUEBA_ID)
    try {
      sessionStorage.removeItem('monix_prueba_tour_visto')
      localStorage.setItem(MOSTRAR_SALDO_KEY, '1')
    } catch {
      /* modo privado */
    }
  }
}

/** Pantallas que en la prueba se ven, pero no se usan. Lo demás funciona sobre el banco simulado (operacionesPrueba). */
const RUTAS_CENSURADAS = new Set([
  '/metas',
  '/depositar',
  '/contactos',
  '/perfil',
  '/promos',
  '/cashback',
  '/mercado-monix',
])

export function pantallaCensuradaEnPrueba(pathname: string) {
  return esModoPrueba() && RUTAS_CENSURADAS.has(pathname)
}

function olvidarBanderaPrueba() {
  try {
    sessionStorage.removeItem(ESTADO_PRUEBA_KEY)
    sessionStorage.removeItem(MODO_PRUEBA_KEY)
  } catch {
    /* modo privado */
  }
  descartarOnboarding()
  useCuentaStore.getState().clear()
}

/** Inicio, login y registro son el banco real: no siguen en la prueba de esta pestaña. */
export function soltarPruebaEnEntradaReal() {
  const path = window.location.pathname
  const puerta = path === '/' || path === '/login' || path === '/register'
  if (!puerta || !esModoPrueba()) return
  olvidarBanderaPrueba()
}

export function salirModoPrueba() {
  olvidarBanderaPrueba()
  useAuthStore.getState().clear()
  // La prueba había tapado la sesión real. Hay que volver a cargarla para que la huella pida desbloqueo.
  useAuthStore.getState().setLoading(true)
  window.dispatchEvent(new Event('monix-salir-prueba'))
}

/** En la prueba no se confirman operaciones reales. No invita a registrarse: eso vive en las pantallas censuradas. */
export function frenarSiEsPrueba() {
  if (!esModoPrueba()) return false
  toast('En la prueba no se confirma esta operación.', { id: 'prueba-freno' })
  return true
}
