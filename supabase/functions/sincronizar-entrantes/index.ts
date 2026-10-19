import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Acredita las transferencias que otros bancos le hicieron al usuario
// logueado (S-1, docs/auditoria-2026-10.md). Antes lo hacía el navegador:
// leía /transactions del Banco Central y escribía el saldo él mismo, así que
// cualquiera podía "acreditarse" una transferencia inventada. Ahora la consulta
// al Banco Central la hace este servidor con su propia API key, y el crédito
// pasa por la RPC acreditar_transferencia_entrante (sólo service_role),
// idempotente por bc_transaccion_id.
//
// Secrets: BC_API_KEY (obligatorio), BC_URL (opcional). SUPABASE_URL,
// SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.

const BC_URL = Deno.env.get("BC_URL") ?? "https://centralbank.brocoly.cc/api"
const VENTANA_MINUTOS = 1440

interface Transaccion {
  _id: string
  cbuOrigen: string
  cbuDestino: string
  importe: number
  estado: string
  bankCodeOrigen: number
  personaOrigen: { nombre?: string; apellido?: string; dni?: string; cbu?: string; alias?: string }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405)

  const apiKey = Deno.env.get("BC_API_KEY")
  if (!apiKey) return jsonResponse({ error: "Falta configurar BC_API_KEY" }, 500)

  // Quién es: el JWT del usuario que manda supabase.functions.invoke().
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return jsonResponse({ error: "No autenticado" }, 401)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!)
  const { data: { user }, error: errUser } = await anon.auth.getUser(token)
  if (errUser || !user) return jsonResponse({ error: "No autenticado" }, 401)

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  })
  const { data: cuentas, error: errCuentas } = await admin
    .from("cuentas")
    .select("id, cbu")
    .eq("persona_id", user.id)
    .eq("activa", true)
  if (errCuentas) return jsonResponse({ error: "No pudimos leer tus cuentas" }, 500)
  const porCbu = new Map((cuentas ?? []).filter((c) => c.cbu).map((c) => [c.cbu as string, c.id as string]))
  if (porCbu.size === 0) return jsonResponse({ acreditadas: 0 })

  let transacciones: Transaccion[] = []
  try {
    const res = await fetch(`${BC_URL}/transactions?minutos=${VENTANA_MINUTOS}`, {
      headers: { "x-api-key": apiKey, "x-environment": "test" },
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status !== 404) {
      if (!res.ok) return jsonResponse({ error: `Banco Central respondió ${res.status}` }, 502)
      transacciones = await res.json()
    }
  } catch {
    return jsonResponse({ error: "No pudimos consultar al Banco Central" }, 502)
  }

  let acreditadas = 0
  for (const t of transacciones) {
    const cuentaId = porCbu.get(t.cbuDestino)
    if (t.estado !== "aprobada" || !cuentaId) continue
    const { data: ok, error } = await admin.rpc("acreditar_transferencia_entrante", {
      p_cuenta_id: cuentaId,
      p_bc_transaccion_id: t._id,
      p_importe: t.importe,
      p_banco_codigo_origen: t.bankCodeOrigen,
      p_nombre: t.personaOrigen?.nombre ?? null,
      p_apellido: t.personaOrigen?.apellido ?? null,
      p_dni: t.personaOrigen?.dni ?? null,
      p_cbu_origen: t.personaOrigen?.cbu ?? t.cbuOrigen,
      p_alias_origen: t.personaOrigen?.alias ?? null,
    })
    if (error) console.error("acreditar_transferencia_entrante", t._id, error.message)
    else if (ok) acreditadas++
  }

  return jsonResponse({ acreditadas })
})
