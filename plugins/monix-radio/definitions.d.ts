export interface MonixRadioPlugin {
  pedirCamara(): Promise<void>
  pedirMic(): Promise<void>
  pedirTodosLosPermisos(): Promise<void>
  abrirAjustes(): Promise<void>
  soportaBiometria(): Promise<{ ok: boolean }>
  verificarBiometria(): Promise<void>
  startVoz(): Promise<void>
  stopVoz(): Promise<void>
  sacarFoto(): Promise<{ dataUrl: string }>
  addListener(event: string, cb: (data: Record<string, unknown>) => void): Promise<{ remove: () => Promise<void> }>
}
