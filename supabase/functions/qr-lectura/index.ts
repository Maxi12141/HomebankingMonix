import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { importJWK, jwtVerify } from "npm:jose@5"
import { createClient } from "npm:@supabase/supabase-js@2"

// Aviso de lectura de QR (docs/qr-interbancario-jwt.md, sección 12).
// Cualquier banco de la cátedra (o la propia app Monix) que escanea un QR
// emitido por Monix hace POST acá con { qr, banco, nombre? }. No hay login:
// la prueba de que el aviso es de un QR real es que `qr` tenga la firma de
// Monix. Se despliega con verify_jwt: false (los otros bancos no tienen
// usuarios de nuestro Supabase).

const MONIX_BANK_CODE = 3
// Clave PÚBLICA de Monix (la misma de src/lib/qrJwt.ts) — no es secreta.
const MONIX_PUBLIC_JWK = {
  kty: "EC",
  crv: "P-256",
  x: "zTedm3fkuqkdsxJXtkuRMvMOljIkZ1GbhUVAfNa9Q5g",
  y: "Z1I2SukE7P6K63Ma_iGD4QYDG164_gs9fuhD9IFj9Js",
}
// Un QR se puede leer hasta su vencimiento; se da un margen chico para
// relojes desfasados y la latencia del aviso.
const TOLERANCIA_SEGUNDOS = 120
// Dos avisos iguales (mismo QR, mismo banco) dentro de esta ventana cuentan
// como uno: la cámara puede leer el mismo código varias veces seguidas.
const VENTANA_DUPLICADO_MS = 30_000

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  let body: { qr?: unknown; banco?: unknown; nombre?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400)
  }

  const { qr, banco, nombre } = body
  if (typeof qr !== "string" || qr.length > 4096) {
    return jsonResponse({ error: "Falta qr" }, 400)
  }
  if (typeof banco !== "number" || !Number.isInteger(banco) || banco <= 0) {
    return jsonResponse({ error: "banco debe ser el bankCode (número entero)" }, 400)
  }
  const nombreLimpio = typeof nombre === "string" ? nombre.trim().slice(0, 40) || null : null

  let claims: { iss?: unknown; cbu?: unknown; jti?: unknown; cid?: unknown }
  try {
    const key = await importJWK(MONIX_PUBLIC_JWK, "ES256")
    const { payload } = await jwtVerify(qr, key, {
      algorithms: ["ES256"],
      clockTolerance: TOLERANCIA_SEGUNDOS,
    })
    claims = payload as typeof claims
  } catch {
    return jsonResponse({ error: "El qr no es un QR válido de Monix o venció" }, 401)
  }
  if (claims.iss !== MONIX_BANK_CODE || typeof claims.cbu !== "string") {
    return jsonResponse({ error: "El qr no es de Monix" }, 401)
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  )

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("id, persona_id")
    .eq("cbu", claims.cbu)
    .eq("activa", true)
    .maybeSingle()
  if (!cuenta) {
    // El QR es auténtico pero la cuenta ya no está activa: no hay a quién avisar.
    return jsonResponse({ ok: true, avisado: false }, 202)
  }

  const jti = typeof claims.jti === "string" ? claims.jti : null
  const cid = typeof claims.cid === "string" ? claims.cid : null

  // Con jti se compara el QR exacto; sin jti (emisores que no lo agregan),
  // alcanza con misma cuenta + mismo banco lector dentro de la ventana.
  const desde = new Date(Date.now() - VENTANA_DUPLICADO_MS).toISOString()
  const base = supabase
    .from("qr_lecturas")
    .select("id")
    .eq("banco_lector", banco)
    .gte("created_at", desde)
  const { data: previo } = await (jti ? base.eq("jti", jti) : base.eq("cuenta_id", cuenta.id)).limit(1)
  if (previo && previo.length > 0) {
    return jsonResponse({ ok: true, avisado: true }, 202)
  }

  const { error } = await supabase.from("qr_lecturas").insert({
    persona_id: cuenta.persona_id,
    cuenta_id: cuenta.id,
    jti,
    cid,
    banco_lector: banco,
    nombre_lector: nombreLimpio,
  })
  if (error) {
    return jsonResponse({ error: "No se pudo registrar el aviso" }, 500)
  }
  return jsonResponse({ ok: true, avisado: true }, 202)
})
