export interface Persona {
  id: string
  nombre: string
  apellido: string
  dni: string
  direccion: string | null
  email: string
  telefono: string | null
  fecha_nac: string | null
  created_at: string
}

export interface Cuenta {
  id: string
  persona_id: string
  numero_cuenta: string
  tipo: 'caja_ahorro' | 'cuenta_corriente'
  saldo: number
  activa: boolean
  cbu: string | null
  alias: string | null
  tasa_anual: number
  ultima_interes_at: string
  created_at: string
}

export interface Reserva {
  id: string
  cuenta_id: string
  saldo: number
  tasa_anual: number
  ultima_interes_at: string
  created_at: string
}

export interface Movimiento {
  id: string
  cuenta_id: string
  tipo: 'deposito' | 'extraccion' | 'transferencia_entrada' | 'transferencia_salida'
  monto: number
  saldo_resultante: number | null
  descripcion: string | null
  cuenta_destino_id: string | null
  destinatario_nombre: string | null
  destinatario_apellido: string | null
  destinatario_dni: string | null
  destino_cbu: string | null
  destino_alias: string | null
  bc_transaccion_id: string | null
  banco_codigo_origen: number | null
  created_at: string
}

export interface Contacto {
  id: string
  nombre: string
  apellido: string
  cbu: string
  alias: string | null
  apodo: string | null
  savedAt: string
}

export interface RegisterFormData {
  nombre: string
  apellido: string
  dni: string
  email: string
  telefono: string
  fecha_nac: string
  direccion: string
  password: string
}
