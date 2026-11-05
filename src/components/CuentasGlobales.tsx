import { useCuenta } from '../hooks/useCuenta'
import { useSyncTransferenciasEntrantes } from '../hooks/useSyncTransferenciasEntrantes'
import { useCierrePorInactividad } from '../hooks/useCierrePorInactividad'
import { useRegistrarUbicacion } from '../hooks/useRegistrarUbicacion'

// Carga las cuentas (y su Realtime) una vez para toda la app logueada: sin
// esto, las páginas que no llaman a useCuenta() por su cuenta (Historial)
// quedan en "Cargando..." al entrar directo o recargar, porque useMovimientos
// espera a que la store tenga cuentas.
export function CuentasGlobales() {
  useCuenta()
  // Una sola sincronización con el Banco Central para toda la app: antes cada
  // pantalla montaba la suya y cada navegación repetía la consulta.
  useSyncTransferenciasEntrantes()
  useCierrePorInactividad()
  useRegistrarUbicacion()
  return null
}
