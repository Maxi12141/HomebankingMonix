// Informa deudas ficticias al Banco Central (POST /central-deudores) para que
// GET /central-deudores/{dni} devuelva situaciones variadas al testear el
// gate de apertura de cuenta en USD (Fase 3 del plan de cuentas multi-moneda).
//
// Uso: node --env-file=.env scripts/seed-central-deudores.mjs
//
// DNIs tomados de la tabla `personas` de Supabase (vía MCP, 19 ago 2026) —
// sólo las 17 personas que ya tienen una cuenta activa; las 3 sin cuenta
// (23906742, 23623890, 21438034) no pueden pasar por el flujo de apertura de
// USD igual, así que no hace falta informarles nada. Corre siempre contra
// x-environment: test. Volver a correr con otro valor pisa el informe
// anterior de Monix para ese DNI (un banco tiene un solo informe activo por DNI).

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
  { dni: '41595650', monto: 0,       situacion: 1 }, // Diego Urenda — aprueba USD
  { dni: '41595666', monto: 0,       situacion: 1 }, // dieguito urendita — aprueba USD
  { dni: '66578765', monto: 0,       situacion: 1 }, // Bruno Trevisan — aprueba USD
  { dni: '35486125', monto: 0,       situacion: 1 }, // tatatito tutututun — aprueba USD
  { dni: '23338391', monto: 0,       situacion: 1 }, // Test Tour — aprueba USD
  { dni: '29859649', monto: 0,       situacion: 1 }, // Test Tour — aprueba USD
  { dni: '23434567', monto: 25000,   situacion: 2 }, // juancho perez — riesgo bajo, aprueba USD
  { dni: '87675678', monto: 40000,   situacion: 2 }, // diego23 urendax — riesgo bajo, aprueba USD
  { dni: '44556677', monto: 18000,   situacion: 2 }, // Juan Perezito — riesgo bajo, aprueba USD
  { dni: '41559441', monto: 12000,   situacion: 2 }, // Diego Urenda — riesgo bajo, aprueba USD
  { dni: '25673182', monto: 30000,   situacion: 2 }, // Test Tour — riesgo bajo, aprueba USD
  { dni: '5553334',  monto: 300000,  situacion: 3 }, // Diegote Malote — riesgo medio, rechaza
  { dni: '26518960', monto: 200000,  situacion: 3 }, // Test Tour — riesgo medio, rechaza
  { dni: '47583239', monto: 850000,  situacion: 4 }, // Maxi Turaglio — riesgo alto, rechaza
  { dni: '23678363', monto: 700000,  situacion: 4 }, // Test Tour — riesgo alto, rechaza
  { dni: '12345345', monto: 2500000, situacion: 5 }, // maxi turaglio — irrecuperable, rechaza
  { dni: '21999705', monto: 4000000, situacion: 5 }, // Test Tour — irrecuperable, rechaza
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
