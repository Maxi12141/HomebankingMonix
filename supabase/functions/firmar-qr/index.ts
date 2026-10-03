import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { SignJWT, importJWK } from "npm:jose@5"

// bankCode real de Monix en el entorno test compartido de la cátedra —
// confirmado con curl contra /persons/{cbu} (ver services/bancoCentral.ts,
// obtenerMiBankCode): esta api-key resuelve siempre a bankCode 3.
const MONIX_BANK_CODE = 3
const KID = "monix-1"
const EXP_SECONDS = 600 // 10 minutos, según la spec de QR interbancario

// La clave privada NO va en este archivo (el repo es público): vive sólo en
// el secret QR_JWT_PRIVATE_KEY (Dashboard → Edge Functions → Secrets), como
// JWK en JSON de una línea.

// Supabase no agrega CORS solo a una Edge Function propia — sin esto el
// navegador bloquea la respuesta al preflight OPTIONS antes de que el POST
// real llegue a salir.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  let body: { cbu?: string; alias?: string; monto?: number; moneda?: string; cid?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400)
  }

  const { cbu, alias, monto, moneda, cid } = body
  if (!cbu || typeof cbu !== "string") {
    return jsonResponse({ error: "Falta cbu" }, 400)
  }
  if (moneda !== "ARS" && moneda !== "USD") {
    return jsonResponse({ error: "moneda debe ser ARS o USD" }, 400)
  }
  if (monto !== undefined && (typeof monto !== "number" || monto <= 0)) {
    return jsonResponse({ error: "monto inválido" }, 400)
  }

  const privateJwkRaw = Deno.env.get("QR_JWT_PRIVATE_KEY")
  let privateKey
  try {
    if (!privateJwkRaw) throw new Error("sin clave")
    privateKey = await importJWK(JSON.parse(privateJwkRaw), "ES256")
  } catch {
    return jsonResponse({ error: "Clave de firma inválida" }, 500)
  }

  const now = Math.floor(Date.now() / 1000)
  const claims: Record<string, unknown> = { iss: MONIX_BANK_CODE, cbu, moneda }
  if (alias) claims.alias = alias
  if (typeof monto === "number") claims.monto = monto
  // cid: id del cobro interno (cobros_qr) — sólo lo usa la propia app Monix
  // para mantener el seguimiento en tiempo real; cualquier otro banco lo ignora.
  if (cid) claims.cid = cid

  try {
    const jwt = await new SignJWT(claims)
      .setProtectedHeader({ alg: "ES256", typ: "JWT", kid: KID })
      .setIssuedAt(now)
      .setExpirationTime(now + EXP_SECONDS)
      // jti: id único de este QR — el banco que lo lee lo devuelve en el aviso
      // de lectura (spec, sección 12) y así se sabe qué QR exacto se escaneó.
      .setJti(crypto.randomUUID())
      .sign(privateKey)

    return jsonResponse({ jwt })
  } catch (err) {
    return jsonResponse({ error: `No se pudo firmar: ${err instanceof Error ? err.message : String(err)}` }, 500)
  }
})
