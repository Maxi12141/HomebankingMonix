import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Movimiento } from '../types'
import logoBlanco from '../assets/logos/logo-blanco.png'

const TIPO_LABEL: Record<string, string> = {
  deposito:              'Depósito',
  extraccion:            'Extracción',
  transferencia_entrada: 'Transferencia recibida',
  transferencia_salida:  'Transferencia enviada',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function row(label: string, value: string, last = false): string {
  return `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 14px 24px;
      ${last ? '' : 'border-bottom: 1px solid #E4ECFA;'}
    ">
      <span style="font-family: Inter, sans-serif; font-size: 13px; color: #5F7394; white-space: nowrap; margin-right: 16px;">${label}</span>
      <span style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 600; color: #001A3D; text-align: right; word-break: break-all;">${value}</span>
    </div>
  `
}

function card(title: string, rows: { label: string; value: string }[]): string {
  if (rows.length === 0) return ''
  return `
    <div style="margin: 0 40px 24px;">
      <div style="
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 10px;
        font-weight: 700;
        color: #8A9BB5;
        letter-spacing: 1px;
        text-transform: uppercase;
        margin-bottom: 8px;
        padding-left: 4px;
      ">${title}</div>
      <div style="background: #F3F6FC; border-radius: 16px; overflow: hidden; border: 1px solid #E4ECFA;">
        ${rows.map((r, i) => row(r.label, r.value, i === rows.length - 1)).join('')}
      </div>
    </div>
  `
}

function buildHTML(mov: Movimiento, bankName?: string): string {
  const entrada = mov.tipo === 'deposito' || mov.tipo === 'transferencia_entrada'
  const fecha = new Date(mov.created_at)

  const raw = mov.descripcion
  const sepIdx = raw ? raw.indexOf('|') : -1
  const motivo = sepIdx >= 0 ? (raw!.slice(0, sepIdx) || null) : raw
  const mensajeParsed = sepIdx >= 0 ? (raw!.slice(sepIdx + 1) || null) : null

  const infoRows: { label: string; value: string }[] = [
    {
      label: 'Fecha',
      value: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }),
    },
    {
      label: 'Hora',
      value: fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    },
  ]
  if (mov.saldo_resultante !== null) {
    infoRows.push({ label: 'Saldo resultante', value: fmt(mov.saldo_resultante) })
  }
  if (motivo) infoRows.push({ label: 'Motivo', value: motivo })
  if (mensajeParsed) infoRows.push({ label: 'Mensaje', value: mensajeParsed })

  const cpRows: { label: string; value: string }[] = []
  if (mov.destinatario_nombre) {
    cpRows.push({
      label: 'Titular',
      value: `${mov.destinatario_nombre} ${mov.destinatario_apellido ?? ''}`.trim(),
    })
  }
  if (mov.destinatario_dni) cpRows.push({ label: 'DNI / CUIT / CUIL', value: mov.destinatario_dni })
  if (mov.destino_cbu) cpRows.push({ label: 'CBU', value: mov.destino_cbu })
  if (mov.destino_alias) cpRows.push({ label: 'Alias', value: mov.destino_alias })
  const bankDisplay = bankName ?? (mov.banco_codigo_origen != null ? `Código ${mov.banco_codigo_origen}` : null)
  if (bankDisplay) cpRows.push({ label: 'Banco origen', value: bankDisplay })

  const amountColor = entrada ? '#00B98C' : '#DC2626'
  const badgeBg     = entrada ? '#D1FAF0' : '#FEE2E2'
  const badgeColor  = entrada ? '#00B98C' : '#DC2626'

  return `
    <div style="
      width: 794px;
      background: #ffffff;
      font-family: Inter, sans-serif;
      -webkit-print-color-adjust: exact;
    ">

      <!-- Header -->
      <div style="
        background: #001A3D;
        padding: 32px 40px 28px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <img src="${logoBlanco}" alt="Monix" style="height: 44px; width: auto; object-fit: contain;" crossorigin="anonymous" />
        <div style="text-align: right;">
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; font-weight: 700; color: #8AB4D8; letter-spacing: 1.5px; text-transform: uppercase;">Banco Digital</div>
          <div style="font-family: Inter, sans-serif; font-size: 10px; color: #4A6E9A; margin-top: 4px; letter-spacing: 0.5px;">COMPROBANTE DE OPERACIÓN</div>
        </div>
      </div>

      <!-- Mint accent line -->
      <div style="height: 4px; background: linear-gradient(90deg, #26FFC1 0%, #1FE6AF 100%);"></div>

      <!-- Amount section -->
      <div style="padding: 40px 40px 32px;">
        <div style="
          font-family: Inter, sans-serif;
          font-size: 11px;
          font-weight: 500;
          color: #8A9BB5;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 10px;
        ">${(TIPO_LABEL[mov.tipo] ?? mov.tipo).toUpperCase()}</div>

        <div style="
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 48px;
          font-weight: 700;
          color: ${amountColor};
          line-height: 1;
          margin-bottom: 16px;
          letter-spacing: -1px;
        ">${entrada ? '+' : '-'}${fmt(mov.monto)}</div>

        <div style="
          display: inline-block;
          background: ${badgeBg};
          color: ${badgeColor};
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 11px;
          font-weight: 700;
          padding: 5px 16px;
          border-radius: 100px;
          letter-spacing: 0.5px;
        ">APROBADO</div>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: #E4ECFA; margin: 0 40px 28px;"></div>

      <!-- Info card -->
      ${card('Detalles de la operación', infoRows)}

      <!-- Contraparte card -->
      ${cpRows.length > 0 ? card(entrada ? 'Cuenta origen' : 'Cuenta destino', cpRows) : ''}

      <!-- Footer -->
      <div style="
        margin-top: 8px;
        background: #F3F6FC;
        padding: 20px 40px;
        border-top: 1px solid #E4ECFA;
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        ">
          <span style="font-family: Inter, sans-serif; font-size: 11px; color: #8A9BB5;">ID de operación: <span style="font-weight:500; color:#5F7394;">${mov.id}</span></span>
          <span style="font-family: Inter, sans-serif; font-size: 11px; color: #8A9BB5;">${new Date().toLocaleString('es-AR')}</span>
        </div>
        <div style="font-family: Inter, sans-serif; font-size: 10px; color: #B0BED4;">
          Comprobante válido como constancia de operación bancaria. Monix Banco Digital.
        </div>
      </div>

    </div>
  `
}

export async function downloadComprobante(mov: Movimiento, bankName?: string): Promise<void> {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;'
  container.innerHTML = buildHTML(mov, bankName)
  document.body.appendChild(container)

  try {
    await document.fonts.ready

    const el = container.firstElementChild as HTMLElement
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdfW = 210
    const pdfH = (canvas.height / canvas.width) * pdfW

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    doc.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)

    const tipo = (TIPO_LABEL[mov.tipo] ?? mov.tipo).toLowerCase().replace(/\s+/g, '_')
    doc.save(`monix_${tipo}_${mov.id.slice(0, 8)}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}
