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

export class MonixRadio {
  private nearbyHandlers = new Set<NearbyHandler>()
  private nfcHandlers = new Set<NfcHandler>()
  private ndef: NDEFReader | null = null
  private scanAbort: AbortController | null = null
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
    this.scanAbort?.abort()
    this.scanAbort = new AbortController()
    this.ndef = new NDEFReader()
    await this.ndef.scan({ signal: this.scanAbort.signal })
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

  async writeNfc(payload: string) {
    const plugin = await getPlugin()
    if (plugin) {
      await plugin.writeNfc({ payload })
      return
    }
    if (!hasNdef()) {
      throw new Error('Acercá una tarjeta NFC al teléfono (Chrome Android) o usá la APK.')
    }
    const writer = new NDEFReader()
    await writer.write({ records: [{ recordType: 'text', data: payload, lang: 'es' }] })
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
