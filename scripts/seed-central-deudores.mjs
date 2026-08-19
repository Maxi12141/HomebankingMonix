// Informa deudas ficticias al Banco Central (POST /central-deudores) para que
// GET /central-deudores/{dni} devuelva situaciones variadas al testear el
// gate de apertura de cuenta en USD (Fase 3 del plan de cuentas multi-moneda).
//
// Uso: node --env-file=.env scripts/seed-central-deudores.mjs
//
// Antes de correrlo: completar DEUDAS_FICTICIAS con los DNI reales de las
// personas de prueba que ya existen en la tabla `personas` de Supabase.
// Corre siempre contra x-environment: test.

const BASE_URL = 'https://centralbank.brocoly.cc/api'
const API_KEY = process.env.VITE_BC_API_KEY

if (!API_KEY) {
  console.error('Falta VITE_BC_API_KEY. Corré con: node --env-file=.env scripts/seed-central-deudores.mjs')
  process.exit(1)
}

const HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
  'x-environment': 'test',
}

// Esquema por fila: { dni, monto, situacion }
// situacion: 1 Normal · 2 riesgo bajo · 3 riesgo medio · 4 riesgo alto · 5 irrecuperable
// dni y monto son responsabilidad de cada informe: "monto" es la deuda que
// ESTE banco (Monix) declara tener con esa persona, no una foto abstracta de
// su perfil completo. Pisa el informe anterior de Monix para el mismo DNI si
// se vuelve a correr con otro valor.
const DEUDAS_FICTICIAS = [
  // { dni: '11111111', monto: 0,       situacion: 1 }, // sin problemas — aprueba USD
  // { dni: '22222222', monto: 15000,   situacion: 2 }, // riesgo bajo — aprueba USD
  // { dni: '33333333', monto: 250000,  situacion: 3 }, // riesgo medio — rechaza
  // { dni: '44444444', monto: 900000,  situacion: 4 }, // riesgo alto — rechaza
  // { dni: '55555555', monto: 3000000, situacion: 5 }, // irrecuperable — rechaza
]

if (DEUDAS_FICTICIAS.length === 0) {
  console.error('DEUDAS_FICTICIAS está vacío — completalo con DNIs reales de Supabase antes de correr el seed.')
  process.exit(1)
}

for (const { dni, monto, situacion } of DEUDAS_FICTICIAS) {
  try {
    const res = await fetch(`${BASE_URL}/central-deudores`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ dni, monto, situacion }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error(`✗ DNI ${dni}: [${res.status}] ${body.message ?? res.statusText}`)
      continue
    }
    console.log(`✓ DNI ${dni} → situación ${situacion} (monto $${monto}) — ${res.status === 201 ? 'creada' : 'actualizada'}`)
  } catch (err) {
    console.error(`✗ DNI ${dni}: ${err.message}`)
  }
}
