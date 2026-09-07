export {}

declare global {
  interface NDEFRecord {
    recordType: string
    mediaType?: string
    id?: string
    encoding?: string
    lang?: string
    data?: BufferSource
  }

  interface NDEFMessage {
    records: NDEFRecord[]
  }

  interface NDEFReadingEvent extends Event {
    serialNumber: string
    message: NDEFMessage
  }

  interface NDEFReader extends EventTarget {
    scan: (options?: { signal?: AbortSignal }) => Promise<void>
    write: (message: unknown, options?: { signal?: AbortSignal }) => Promise<void>
    onreading: ((event: NDEFReadingEvent) => void) | null
  }

  var NDEFReader: {
    prototype: NDEFReader
    new (): NDEFReader
  }
}
