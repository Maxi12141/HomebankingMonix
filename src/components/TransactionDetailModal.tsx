import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Card } from './ui/Card'
import { downloadComprobante } from '../utils/comprobante'
import type { Movimiento } from '../types'

interface Props {
  movimiento: Movimiento | null
  bankName?: string
  onClose: () => void
}

const tipoLabel: Record<string, string> = {
  deposito: 'Depósito',
  extraccion: 'Extracción',
  transferencia_entrada: 'Transferencia recibida',
  transferencia_salida: 'Transferencia enviada',
}

function esEntrada(tipo: Movimiento['tipo']) {
  return tipo === 'deposito' || tipo === 'transferencia_entrada'
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-body text-xs text-slate-secondary">{label}</span>
      <span className="font-body text-sm text-navy dark:text-white">{value}</span>
    </div>
  )
}

export function TransactionDetailModal({ movimiento, bankName, onClose }: Props) {
  const [downloading, setDownloading] = useState(false)

  if (!movimiento) return null

  async function handleDownload() {
    if (!movimiento || downloading) return
    setDownloading(true)
    try { await downloadComprobante(movimiento, bankName) } finally { setDownloading(false) }
  }

  const entrada = esEntrada(movimiento.tipo)
  const montoFormateado = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(movimiento.monto)
  const saldoFormateado = movimiento.saldo_resultante !== null
    ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(movimiento.saldo_resultante)
    : null
  const fecha = new Date(movimiento.created_at)
  const fechaFormateada = fecha.toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const horaFormateada = fecha.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  const tieneContraparte =
    movimiento.destinatario_nombre ||
    movimiento.destino_cbu ||
    movimiento.destino_alias

  const raw = movimiento.descripcion
  const sepIdx = raw ? raw.indexOf('|') : -1
  const motivo = sepIdx >= 0 ? (raw!.slice(0, sepIdx) || null) : raw
  const mensajeParsed = sepIdx >= 0 ? (raw!.slice(sepIdx + 1) || null) : null

  return (
    <Modal open={!!movimiento} onClose={onClose}>
      <Card className="p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-body text-xs text-slate-secondary uppercase tracking-wider mb-1">
              {tipoLabel[movimiento.tipo]}
            </p>
            <p className={`font-display text-3xl font-semibold ${entrada ? 'text-mint' : 'text-red-500 dark:text-red-400'}`}>
              {entrada ? '+' : '-'}{montoFormateado}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="text-slate-secondary hover:text-mint transition-colors disabled:opacity-50"
              aria-label="Descargar comprobante"
              title="Descargar comprobante PDF"
            >
              {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            </button>
            <button
              onClick={onClose}
              className="text-slate-secondary hover:text-navy dark:hover:text-white transition-colors text-xl leading-none"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="h-px bg-slate-200 dark:bg-white/10" />

        {/* Fecha y hora */}
        <div className="flex gap-6">
          <DetailRow label="Fecha" value={fechaFormateada} />
          <DetailRow label="Hora" value={horaFormateada} />
        </div>

        {saldoFormateado && (
          <DetailRow label="Saldo resultante" value={saldoFormateado} />
        )}

        {motivo && <DetailRow label="Motivo" value={motivo} />}
        {mensajeParsed && <DetailRow label="Mensaje" value={mensajeParsed} />}

        {/* Datos de la contraparte */}
        {tieneContraparte && (
          <>
            <div className="h-px bg-slate-200 dark:bg-white/10" />
            <p className="font-body text-xs text-slate-secondary uppercase tracking-wider">
              {entrada ? 'Cuenta origen' : 'Cuenta destino'}
            </p>
            <div className="flex flex-col gap-3">
              {movimiento.destinatario_nombre && (
                <DetailRow
                  label="Titular"
                  value={`${movimiento.destinatario_nombre} ${movimiento.destinatario_apellido ?? ''}`}
                />
              )}
              <DetailRow label="DNI / CUIT / CUIL" value={movimiento.destinatario_dni} />
              <DetailRow label="CBU" value={movimiento.destino_cbu} />
              <DetailRow label="Alias" value={movimiento.destino_alias} />
              <DetailRow
                label="Banco origen"
                value={bankName ?? (movimiento.banco_codigo_origen != null ? `Banco #${movimiento.banco_codigo_origen}` : null)}
              />
            </div>
          </>
        )}
      </Card>
    </Modal>
  )
}
