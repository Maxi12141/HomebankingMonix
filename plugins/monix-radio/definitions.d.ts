export interface MonixRadioPlugin {
  startCerca(options: Record<string, string>): Promise<void>
  stopCerca(): Promise<void>
  startScan(): Promise<void>
  stopScan(): Promise<void>
  startNfcListen(): Promise<void>
  stopNfcListen(): Promise<void>
  writeNfc(options: { payload: string }): Promise<void>
  startHce(options: { payload: string }): Promise<void>
  stopHce(): Promise<void>
  addListener(event: string, cb: (data: Record<string, unknown>) => void): Promise<{ remove: () => Promise<void> }>
}
