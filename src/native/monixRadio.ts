export interface RadioCapabilities {
  native: boolean
  nfc: boolean
  ble: boolean
}

export interface NearbyToken {
  token: string
  rssi?: number
  payload?: string
}

type NearbyHandler = (event: NearbyToken) => void
type NfcHandler = (payload: string) => void

function hasNdef(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window
}

function isNative(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return Boolean(cap?.isNativePlatform?.())
}

async function getPlugin(): Promise<{
  startCerca: (opts: Record<string, string>) => Promise<void>
  stopCerca: () => Promise<void>
  startScan: () => Promise<void>
  stopScan: () => Promise<void>
  startNfcListen: () => Promise<void>
  stopNfcListen: () => Promise<void>
  writeNfc: (opts: { payload: string }) => Promise<void>
  startHce: (opts: { payload: string }) => Promise<void>
  stopHce: () => Promise<void>
  pedirCamara?: () => Promise<void>
  pedirMic?: () => Promise<void>
  pedirTodosLosPermisos?: () => Promise<void>
  requestPermissions?: () => Promise<void>
  abrirAjustes?: () => Promise<void>
  soportaBiometria?: () => Promise<{ ok?: boolean }>
  verificarBiometria?: () => Promise<void>
  startVoz?: () => Promise<void>
  stopVoz?: () => Promise<void>
  addListener: (event: string, cb: (data: Record<string, unknown>) => void) => Promise<{ remove: () => Promise<void> }>
} | null> {
  if (!isNative()) return null
  try {
    const core = await import('@capacitor/core')
    return core.registerPlugin('MonixRadio')
  } catch {
    return null
  }
}

export function radioCapabilities(): RadioCapabilities {
  return {
    native: isNative(),
    nfc: hasNdef() || isNative(),
    ble: isNative(),
  }
}

export async function pedirPermisoCamara() {
  try {
    const plugin = await getPlugin()
    const pedir = plugin?.pedirCamara
    if (!pedir) return
    await pedir()
  } catch {
    /* APK vieja o permiso ya negado: getUserMedia igual dispara el diálogo del WebView */
  }
}

export async function pedirPermisosNativos() {
  try {
    const plugin = await getPlugin()
    if (plugin?.pedirTodosLosPermisos) {
      await plugin.pedirTodosLosPermisos()
      return
    }
    await plugin?.pedirCamara?.()
    await plugin?.pedirMic?.()
    await plugin?.requestPermissions?.()
  } catch {
    /* diálogo cancelado o APK vieja */
  }
}

async function pedirMediosWeb() {
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true })
        cam.getTracks().forEach((t) => t.stop())
      } catch {
        /* cámara denegada */
      }
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
        mic.getTracks().forEach((t) => t.stop())
      } catch {
        /* mic denegado */
      }
    }
  }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  } catch {
    /* notificaciones no disponibles */
  }
  if (isNative() || !hasNdef()) return
  const ac = new AbortController()
  try {
    await new NDEFReader().scan({ signal: ac.signal })
  } catch {
    /* NFC denegado o no disponible en Chrome */
  } finally {
    ac.abort()
  }
}

export async function pedirTodosLosPermisos() {
  await pedirPermisosNativos()
  await pedirMediosWeb()
}

export async function abrirAjustesPermisos() {
  try {
    const plugin = await getPlugin()
    await plugin?.abrirAjustes?.()
  } catch {
    /* APK vieja */
  }
}

export async function soportaBiometriaNativa() {
  try {
    const plugin = await getPlugin()
    const res = await plugin?.soportaBiometria?.()
    return Boolean(res?.ok)
  } catch {
    return false
  }
}

export async function verificarBiometriaNativa() {
  const plugin = await getPlugin()
  const fn = plugin?.verificarBiometria
  if (!fn) throw new Error('Actualizá la APK de Monix para usar huella o Face ID')
  await fn()
}

export async function startVozNativa() {
  const plugin = await getPlugin()
  const fn = plugin?.startVoz
  if (!fn) throw new Error('Actualizá la APK de Monix para hablarle a Moni')
  await fn()
}

export async function stopVozNativa() {
  try {
    const plugin = await getPlugin()
    await plugin?.stopVoz?.()
  } catch {
    /* ya estaba parado */
  }
}

export async function onVozNativa(handler: (text: string, isFinal: boolean) => void) {
  const plugin = await getPlugin()
  if (!plugin?.addListener) return null
  return plugin.addListener('voz', (data) => {
    handler(String(data.text ?? ''), Boolean(data.final))
  })
}

function mensajeNfc(err: unknown): Error {
  const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : ''
  const raw = err instanceof Error ? err.message : ''
  if (name === 'NotAllowedError' || /permission|denied|not allowed/i.test(raw)) {
    return new Error(
      'Chrome bloqueó el NFC. Tocá el candado de la barra → Permisos → NFC → Permitir. Con la APK de Monix no hace falta este permiso.',
    )
  }
  return err instanceof Error ? err : new Error('No se pudo activar el NFC')
}

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String(err.name) : ''
  const message = 'message' in err ? String(err.message) : ''
  return name === 'AbortError' || /signal is aborted/i.test(message)
}

export class MonixRadio {
  private nearbyHandlers = new Set<NearbyHandler>()
  private nfcHandlers = new Set<NfcHandler>()
  private ndef: NDEFReader | null = null
  private scanAbort: AbortController | null = null
  private webNfcActive = false
  private pluginUnsubs: Array<{ remove: () => Promise<void> }> = []
  private advertising = false

  onNearby(handler: NearbyHandler) {
    this.nearbyHandlers.add(handler)
    return () => this.nearbyHandlers.delete(handler)
  }

  onNfc(handler: NfcHandler) {
    this.nfcHandlers.add(handler)
    return () => this.nfcHandlers.delete(handler)
  }

  private emitNearby(event: NearbyToken) {
    this.nearbyHandlers.forEach((h) => h(event))
  }

  private emitNfc(payload: string) {
    this.nfcHandlers.forEach((h) => h(payload))
    const tokenMatch = payload.match(/[0-9a-f]{32,64}/i)
    if (tokenMatch) this.emitNearby({ token: tokenMatch[0].toLowerCase() })
  }

  async startAdvertising(opts: {
    token: string
    accessToken?: string
    supabaseUrl?: string
    supabaseKey?: string
    cuentaId?: string
  }) {
    this.advertising = true
    const plugin = await getPlugin()
    if (plugin) {
      const withPerms = plugin as { requestPermissions?: () => Promise<void> }
      await withPerms.requestPermissions?.()
      await plugin.startCerca({
        token: opts.token,
        accessToken: opts.accessToken ?? '',
        supabaseUrl: opts.supabaseUrl ?? '',
        supabaseKey: opts.supabaseKey ?? '',
        cuentaId: opts.cuentaId ?? '',
      })
    }
  }

  async stopAdvertising() {
    this.advertising = false
    const plugin = await getPlugin()
    if (plugin) await plugin.stopCerca()
  }

  get isAdvertising() {
    return this.advertising
  }

  async startScan() {
    const plugin = await getPlugin()
    if (plugin) {
      const sub = await plugin.addListener('deviceFound', (data) => {
        const token = String(data.token ?? '')
        if (token) this.emitNearby({ token, rssi: Number(data.rssi ?? 0) || undefined })
      })
      this.pluginUnsubs.push(sub)
      await plugin.startScan()
      return
    }

    await this.startWebNfcListen()
  }

  async stopScan() {
    const plugin = await getPlugin()
    if (plugin) await plugin.stopScan()
    this.webNfcActive = false
    this.scanAbort?.abort()
    this.scanAbort = null
    this.ndef = null
    await Promise.all(this.pluginUnsubs.map((u) => u.remove()))
    this.pluginUnsubs = []
  }

  async startNfcListen() {
    const plugin = await getPlugin()
    if (plugin) {
      const sub = await plugin.addListener('nfcRead', (data) => {
        const payload = String(data.payload ?? '')
        if (payload) this.emitNfc(payload)
      })
      this.pluginUnsubs.push(sub)
      await plugin.startNfcListen()
      return
    }
    await this.startWebNfcListen()
  }

  private async startWebNfcListen() {
    if (!hasNdef()) {
      throw new Error('Este navegador no soporta NFC. Usá Chrome en Android o la APK de Monix.')
    }
    if (this.webNfcActive) return
    this.scanAbort = new AbortController()
    this.ndef = new NDEFReader()
    this.webNfcActive = true
    try {
      await this.ndef.scan({ signal: this.scanAbort.signal })
    } catch (err) {
      this.webNfcActive = false
      this.ndef = null
      if (isAbortError(err)) return
      throw mensajeNfc(err)
    }
    if (!this.ndef) return
    this.ndef.onreading = (event) => {
      for (const record of event.message.records) {
        try {
          const decoder = new TextDecoder(record.encoding ?? 'utf-8')
          const text = decoder.decode(record.data)
          if (text) this.emitNfc(text)
        } catch {
          /* ignore binary records */
        }
      }
    }
  }

  async writeNfc(payload: string, options?: { signal?: AbortSignal }) {
    const plugin = await getPlugin()
    if (plugin) {
      await plugin.writeNfc({ payload })
      return
    }
    if (!hasNdef()) {
      throw new Error('En este navegador no se puede grabar NFC. Probá Chrome en Android con un sticker, o la APK.')
    }
    const writer = new NDEFReader()
    await writer.write(
      { records: [{ recordType: 'text', data: payload, lang: 'es' }] },
      options?.signal ? { signal: options.signal } : undefined,
    )
  }

  async startHce(payload: string) {
    const plugin = await getPlugin()
    if (plugin) {
      await plugin.startHce({ payload })
      return
    }
    throw new Error('Para pagar acercando este teléfono necesitás la APK de Monix. En el navegador podés grabar el chip de la tarjeta física.')
  }

  async stopHce() {
    const plugin = await getPlugin()
    if (plugin) await plugin.stopHce()
  }
}

export const monixRadio = new MonixRadio()
