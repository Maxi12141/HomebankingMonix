import type { User } from '@supabase/supabase-js'
import type { Cuenta, Movimiento, Persona, Reserva } from '../types'
import { marcarUsuarioNuevo, descartarOnboarding } from './onboarding'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useCuentaStore } from '../store/cuentaStore'

const MODO_PRUEBA_KEY = 'monix_modo_prueba'
const MOSTRAR_SALDO_KEY = 'monix_mostrar_saldo'

export const USUARIO_PRUEBA_ID = '00000000-0000-4000-8000-000000000001'
export const CUENTA_PRUEBA_ARS_ID = '00000000-0000-4000-8000-0000000000a1'
export const CUENTA_PRUEBA_USD_ID = '00000000-0000-4000-8000-0000000000a2'

export function esModoPrueba() {
  try {
    return sessionStorage.getItem(MODO_PRUEBA_KEY) === '1'
  } catch {
    return false
  }
}

function hace(dias: number, horas: number) {
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
    apellido: 'Prueba',
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
  const ars: Cuenta = {
    id: CUENTA_PRUEBA_ARS_ID,
    persona_id: USUARIO_PRUEBA_ID,
    numero_cuenta: '0001842201',
    tipo: 'caja_ahorro',
    moneda: 'ARS',
    saldo: 162_300,
    activa: true,
    cbu: '0000003100098765432101',
    alias: 'alex.prueba.monix',
    tasa_anual: 32,
    ultima_interes_at: alta,
    created_at: alta,
  }
  const usd: Cuenta = {
    id: CUENTA_PRUEBA_USD_ID,
    persona_id: USUARIO_PRUEBA_ID,
    numero_cuenta: '0001842202',
    tipo: 'caja_ahorro',
    moneda: 'USD',
    saldo: 120.5,
    activa: true,
    cbu: '0000003100098765432102',
    alias: 'dolares.prueba.monix',
    tasa_anual: 2,
    ultima_interes_at: alta,
    created_at: alta,
  }
  return [ars, usd]
}

export function movimientosPrueba(): Movimiento[] {
  const lista: Movimiento[] = [
    {
      id: 'demo-mov-1',
      cuenta_id: CUENTA_PRUEBA_ARS_ID,
      tipo: 'transferencia_salida',
      moneda: 'ARS',
      monto: 6_200,
      saldo_resultante: 162_300,
      descripcion: 'Supermercado del barrio',
      cuenta_destino_id: null,
      destinatario_nombre: 'Super',
      destinatario_apellido: 'Norte',
      destinatario_dni: null,
      destino_cbu: '0000003100011111111111',
      destino_alias: 'super.norte.mp',
      bc_transaccion_id: null,
      banco_codigo_origen: null,
      created_at: hace(0, 18),
    },
    {
      id: 'demo-mov-2',
      cuenta_id: CUENTA_PRUEBA_ARS_ID,
      tipo: 'transferencia_entrada',
      moneda: 'ARS',
      monto: 18_500,
      saldo_resultante: 168_500,
      descripcion: 'De María Gómez',
      cuenta_destino_id: null,
      destinatario_nombre: 'María',
      destinatario_apellido: 'Gómez',
      destinatario_dni: null,
      destino_cbu: null,
      destino_alias: null,
      bc_transaccion_id: null,
      banco_codigo_origen: null,
      created_at: hace(1, 15),
    },
    {
      id: 'demo-mov-3',
      cuenta_id: CUENTA_PRUEBA_ARS_ID,
      tipo: 'deposito',
      moneda: 'ARS',
      monto: 150_000,
      saldo_resultante: 150_000,
      descripcion: 'Bono de bienvenida',
      cuenta_destino_id: null,
      destinatario_nombre: null,
      destinatario_apellido: null,
      destinatario_dni: null,
      destino_cbu: null,
      destino_alias: null,
      bc_transaccion_id: null,
      banco_codigo_origen: null,
      created_at: hace(0, 9),
    },
    {
      id: 'demo-mov-4',
      cuenta_id: CUENTA_PRUEBA_USD_ID,
      tipo: 'deposito',
      moneda: 'USD',
      monto: 120.5,
      saldo_resultante: 120.5,
      descripcion: 'Saldo de muestra',
      cuenta_destino_id: null,
      destinatario_nombre: null,
      destinatario_apellido: null,
      destinatario_dni: null,
      destino_cbu: null,
      destino_alias: null,
      bc_transaccion_id: null,
      banco_codigo_origen: null,
      created_at: hace(2, 11),
    },
  ]
  return lista.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function reservaPrueba(): Reserva {
  return {
    id: '00000000-0000-4000-8000-0000000000b1',
    cuenta_id: CUENTA_PRUEBA_ARS_ID,
    saldo: 25_000,
    tasa_anual: 32,
    ultima_interes_at: hace(0, 8),
    created_at: hace(3, 8),
  }
}

/** Arma la sesión ficticia. `reiniciarTour` vuelve a mostrar el bono y el tutorial. */
export function entrarModoPrueba(opts?: { reiniciarTour?: boolean }) {
  sessionStorage.setItem(MODO_PRUEBA_KEY, '1')
  const auth = useAuthStore.getState()
  if (auth.user?.id !== USUARIO_PRUEBA_ID) {
    auth.setUser(usuarioPrueba())
    auth.setPersona(personaPrueba())
  }
  auth.setLoading(false)

  const cuentas = cuentasPrueba()
  const store = useCuentaStore.getState()
  if (!store.cuentasLoaded || store.cuenta?.id !== CUENTA_PRUEBA_ARS_ID) {
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

/** Pantallas que en la prueba se ven, pero no se usan: el resto (transferir, QR, tarjetas, reservas) queda abierto. */
const RUTAS_CENSURADAS = new Set([
  '/dolares',
  '/metas',
  '/prestamos',
  '/depositar',
  '/historial',
  '/contactos',
  '/perfil',
  '/promos',
  '/cashback',
  '/mercado-monix',
])

export function pantallaCensuradaEnPrueba(pathname: string) {
  return esModoPrueba() && RUTAS_CENSURADAS.has(pathname)
}

export function salirModoPrueba() {
  try {
    sessionStorage.removeItem(MODO_PRUEBA_KEY)
  } catch {
    /* modo privado */
  }
  descartarOnboarding()
  useAuthStore.getState().clear()
  useCuentaStore.getState().clear()
}

/** En la prueba no se confirman operaciones reales. No invita a registrarse: eso vive en las pantallas censuradas. */
export function frenarSiEsPrueba() {
  if (!esModoPrueba()) return false
  toast('En la prueba no se confirma esta operación.', { id: 'prueba-freno' })
  return true
}
