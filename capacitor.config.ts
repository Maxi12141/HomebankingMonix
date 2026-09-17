import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim()

const config: CapacitorConfig = {
  appId: 'ar.monix.banco',
  appName: 'Monix',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    adjustMarginsForEdgeToEdge: 'force',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#FFFFFF',
    },
  },
}

if (serverUrl) {
  const host = new URL(serverUrl).hostname
  config.server = {
    url: serverUrl,
    hostname: host,
    androidScheme: 'https',
    allowNavigation: [host],
    cleartext: serverUrl.startsWith('http://'),
  }
}

export default config
