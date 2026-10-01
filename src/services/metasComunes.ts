import { supabase } from '../lib/supabaseClient'
import { rpcMessage } from '../lib/tokens'

export interface MetaResumen {
  id: string
  titulo: string
  proposito: string
  objetivo: number | null
  saldo: number
  tasaAnual: number
  rendimientoAcumulado: number
  estado: 'abierta' | 'votacion' | 'desembolsada'
  codigo: string
  miembros: number
  miAporte: number
}

export interface MetaMiembro {
  personaId: string
  nombre: string
  apellido: string
  rol: 'creador' | 'miembro'
  aporteTotal: number
}

export interface MetaAporte {
  id: string
  nombre: string | null
  apellido: string | null
  monto: number
  tipo: 'aporte' | 'rendimiento' | 'pago' | 'devolucion'
  createdAt: string
}

export interface MetaVoto {
  personaId: string
  nombre: string
  apellido: string
  aFavor: boolean
}

export interface MetaVotacion {
  id: string
  tipo: 'pagar' | 'devolver'
  destinoCbu: string | null
  destinoAlias: string | null
  destinoNombre: string | null
  concepto: string | null
  estado: string
  aFavor: number
  enContra: number
  necesarios: number
  miembros: number
  miVoto: boolean | null
  votos: MetaVoto[]
}

export interface MetaDetalle {
  id: string
  titulo: string
  proposito: string
  objetivo: number | null
  saldo: number
  tasaAnual: number
  rendimientoAcumulado: number
  codigo: string
  estado: 'abierta' | 'votacion' | 'desembolsada'
  creadorId: string
  createdAt: string
  estimacionDiaria: number
  miembros: MetaMiembro[]
  aportes: MetaAporte[]
  votacion: MetaVotacion | null
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(rpcMessage(error, 'No se pudo completar la operación'))
  return data as T
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

function parseVotacion(raw: unknown): MetaVotacion | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  if (typeof v.id !== 'string') return null
  const votosRaw = Array.isArray(v.votos) ? v.votos : []
  return {
    id: v.id,
    tipo: v.tipo === 'devolver' ? 'devolver' : 'pagar',
    destinoCbu: v.destinoCbu == null ? null : String(v.destinoCbu),
    destinoAlias: v.destinoAlias == null ? null : String(v.destinoAlias),
    destinoNombre: v.destinoNombre == null ? null : String(v.destinoNombre),
    concepto: v.concepto == null ? null : String(v.concepto),
    estado: str(v.estado),
    aFavor: num(v.aFavor),
    enContra: num(v.enContra),
    necesarios: num(v.necesarios),
    miembros: num(v.miembros),
    miVoto: typeof v.miVoto === 'boolean' ? v.miVoto : null,
    votos: votosRaw.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const r = row as Record<string, unknown>
      if (typeof r.personaId !== 'string') return []
      return [{
        personaId: r.personaId,
        nombre: str(r.nombre),
        apellido: str(r.apellido),
        aFavor: Boolean(r.aFavor),
      }]
    }),
  }
}

function parseDetalle(data: unknown): MetaDetalle {
  if (!data || typeof data !== 'object') throw new Error('No se pudo leer la meta')
  const r = data as Record<string, unknown>
  if (typeof r.id !== 'string') throw new Error('No se pudo leer la meta')
  const miembros = Array.isArray(r.miembros) ? r.miembros : []
  const aportes = Array.isArray(r.aportes) ? r.aportes : []
  const estado = r.estado === 'votacion' || r.estado === 'desembolsada' ? r.estado : 'abierta'
  return {
    id: r.id,
    titulo: str(r.titulo),
    proposito: str(r.proposito),
    objetivo: r.objetivo == null ? null : num(r.objetivo),
    saldo: num(r.saldo),
    tasaAnual: num(r.tasaAnual),
    rendimientoAcumulado: num(r.rendimientoAcumulado),
    codigo: str(r.codigo),
    estado,
    creadorId: str(r.creadorId),
    createdAt: str(r.createdAt),
    estimacionDiaria: num(r.estimacionDiaria),
    miembros: miembros.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const m = row as Record<string, unknown>
      if (typeof m.personaId !== 'string') return []
      return [{
        personaId: m.personaId,
        nombre: str(m.nombre),
        apellido: str(m.apellido),
        rol: m.rol === 'creador' ? 'creador' : 'miembro',
        aporteTotal: num(m.aporteTotal),
      }]
    }),
    aportes: aportes.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const a = row as Record<string, unknown>
      if (typeof a.id !== 'string') return []
      const tipo = a.tipo
      return [{
        id: a.id,
        nombre: a.nombre == null ? null : String(a.nombre),
        apellido: a.apellido == null ? null : String(a.apellido),
        monto: num(a.monto),
        tipo: tipo === 'rendimiento' || tipo === 'pago' || tipo === 'devolucion' ? tipo : 'aporte',
        createdAt: str(a.createdAt),
      }]
    }),
    votacion: parseVotacion(r.votacion),
  }
}

export async function listarMetasComunes(): Promise<MetaResumen[]> {
  const data = await rpc<unknown>('listar_metas_comunes')
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const r = row as Record<string, unknown>
    if (typeof r.id !== 'string') return []
    const estado = r.estado === 'votacion' || r.estado === 'desembolsada' ? r.estado : 'abierta'
    return [{
      id: r.id,
      titulo: str(r.titulo),
      proposito: str(r.proposito),
      objetivo: r.objetivo == null ? null : num(r.objetivo),
      saldo: num(r.saldo),
      tasaAnual: num(r.tasaAnual),
      rendimientoAcumulado: num(r.rendimientoAcumulado),
      estado,
      codigo: str(r.codigo),
      miembros: num(r.miembros),
      miAporte: num(r.miAporte),
    }]
  })
}

export async function crearMetaComun(titulo: string, proposito: string, objetivo: number | null) {
  return parseDetalle(await rpc('crear_meta_comun', {
    p_titulo: titulo,
    p_proposito: proposito,
    p_objetivo: objetivo,
  }))
}

export async function unirseMetaComun(codigo: string) {
  return parseDetalle(await rpc('unirse_meta_comun', { p_codigo: codigo }))
}

export async function invitarMetaComun(metaId: string, alias: string) {
  return parseDetalle(await rpc('invitar_meta_comun', { p_meta_id: metaId, p_alias: alias }))
}

export async function detalleMetaComun(metaId: string) {
  return parseDetalle(await rpc('detalle_meta_comun', { p_meta_id: metaId }))
}

export async function aportarMetaComun(metaId: string, cuentaId: string, monto: number) {
  return parseDetalle(await rpc('aportar_meta_comun', {
    p_meta_id: metaId,
    p_cuenta_id: cuentaId,
    p_monto: monto,
    p_operacion_id: crypto.randomUUID(),
  }))
}

export async function proponerDesembolsoMeta(
  metaId: string,
  tipo: 'pagar' | 'devolver',
  destino: string,
  concepto: string,
) {
  return parseDetalle(await rpc('proponer_desembolso_meta', {
    p_meta_id: metaId,
    p_tipo: tipo,
    p_destino: destino,
    p_concepto: concepto,
  }))
}

export async function votarMetaComun(votacionId: string, aFavor: boolean) {
  return parseDetalle(await rpc('votar_meta_comun', {
    p_votacion_id: votacionId,
    p_a_favor: aFavor,
  }))
}
