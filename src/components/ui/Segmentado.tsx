import type { CSSProperties } from 'react'
import PillNav from '../PillNav'

interface Opcion<T extends string> {
  value: T
  label: string
}

interface SegmentadoProps<T extends string> {
  opciones: readonly Opcion<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  /** Para fondos navy (panel QR a pantalla completa). */
  oscuro?: boolean
  className?: string
}

/** Selector de 2-3 opciones con la pastilla mint deslizante de PillNav (React Bits). */
export default function Segmentado<T extends string>({
  opciones,
  value,
  onChange,
  ariaLabel,
  oscuro = false,
  className = '',
}: SegmentadoProps<T>) {
  return (
    <PillNav
      items={opciones.map((o) => ({ label: o.label }))}
      activeIndex={opciones.findIndex((o) => o.value === value)}
      onItemClick={(_, i) => onChange(opciones[i].value)}
      ariaLabel={ariaLabel}
      fullWidth
      collapse="never"
      intro={false}
      surface="none"
      itemStyle="plain"
      hoverEffect="none"
      indicator="pill"
      highlightColor="#26FFC1"
      highlightTextColor="#001A3D"
      className={`rounded-xl ${oscuro ? 'bg-white/10' : 'bg-slate-input dark:bg-white/5'} ${className}`}
      style={
        {
          // 52 - 2×4 de padding = opciones de 44 px, el mínimo táctil de CONSTRAINTS.md.
          '--pn-h': '52px',
          '--pn-pad': '4px',
          '--pn-item-gap': '8px',
          '--pn-bar-r': '12px',
          '--pn-item-r': '8px',
          '--pn-text': oscuro ? 'rgba(255, 255, 255, 0.6)' : 'var(--slate-secondary)',
          '--pn-strong': oscuro ? '#ffffff' : 'currentColor',
          '--pn-ring': oscuro ? '#26FFC1' : 'currentColor',
        } as CSSProperties
      }
    />
  )
}
