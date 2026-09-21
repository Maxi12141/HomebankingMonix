import { useState, useRef, useEffect } from 'react'
import { BadgeCheck, Lock, AtSign, Camera, Eye, EyeOff, Wallet, Fingerprint, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { useCuenta } from '../hooks/useCuenta'
import { useCuentaStore } from '../store/cuentaStore'
import { useAvatarStore } from '../stores/avatarStore'
import { asignarAlias, buscarPorAlias } from '../services/bancoCentral'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import {
  activarBiometria,
  borrarCredencialBio,
  borrarNombreBio,
  desactivarBiometria,
  esCelular,
  guardarCredencialBio,
  guardarNombreBio,
  huellaActiva,
  soportaHuella,
} from '../lib/biometria'
import { pedirTodosLosPermisos } from '../native/monixRadio'

export function ProfilePage() {
  const { persona, user, setPersona } = useAuthStore()
  const { cuenta } = useCuenta()
  const { setCuenta } = useCuentaStore()
  const { photos, setPhoto, removePhoto } = useAvatarStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const avatarUrl = user ? photos[user.id] : undefined
  const initials = persona ? `${persona.nombre[0]}${persona.apellido[0]}`.toUpperCase() : '?'

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar 2 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(user.id, reader.result as string)
      toast.success('Foto de perfil actualizada')
    }
    reader.readAsDataURL(file)
  }

  const [editMode, setEditMode] = useState(false)
  const [email, setEmail] = useState(persona?.email ?? '')
  const [telefono, setTelefono] = useState(persona?.telefono ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [aliasInput, setAliasInput] = useState(cuenta?.alias ?? '')
  const [savingAlias, setSavingAlias] = useState(false)
  const [aliasError, setAliasError] = useState('')
  const [showData, setShowData] = useState(false)

  const [sueldoAcreditado, setSueldoAcreditado] = useState(persona?.sueldo_acreditado ?? false)
  const [ingresoMensual, setIngresoMensual] = useState(persona?.ingreso_mensual?.toString() ?? '')
  const [savingCredito, setSavingCredito] = useState(false)

  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [savingPass, setSavingPass] = useState(false)
  const [passError, setPassError] = useState('')
  const [bioActiva, setBioActiva] = useState(false)
  const [huellaDisponible, setHuellaDisponible] = useState(() => esCelular())
  const [savingBio, setSavingBio] = useState(false)
  const [savingPermisos, setSavingPermisos] = useState(false)
  const [confirmandoBio, setConfirmandoBio] = useState(false)
  const [confirmPass, setConfirmPass] = useState('')
  const [confirmError, setConfirmError] = useState('')

  useEffect(() => {
    if (!user) return
    setBioActiva(huellaActiva(user.id))
    if (esCelular()) {
      setHuellaDisponible(true)
      return
    }
    void soportaHuella().then(setHuellaDisponible)
  }, [user])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!persona) return
    setSavingProfile(true)

    const emailCambio = email !== persona.email
    if (emailCambio) {
      const { error: authError } = await supabase.auth.updateUser({ email })
      if (authError) {
        toast.error('Error al actualizar el email')
        setSavingProfile(false)
        return
      }
    }

    const { error } = await supabase
      .from('personas')
      .update({ email, telefono: telefono || null })
      .eq('id', persona.id)

    if (!error) {
      setPersona({ ...persona, email, telefono: telefono || null })
      toast.success(emailCambio
        ? 'Datos actualizados. Revisá tu email para confirmar el cambio.'
        : 'Datos actualizados correctamente'
      )
      setEditMode(false)
    } else {
      toast.error('Error al actualizar los datos')
    }
    setSavingProfile(false)
  }

  async function handleSaveAlias(e: React.FormEvent) {
    e.preventDefault()
    if (!cuenta?.cbu) return
    setSavingAlias(true)
    setAliasError('')
    if (/\s/.test(aliasInput)) {
      setAliasError('El alias no puede contener espacios')
      setSavingAlias(false)
      return
    }
    try {
      try {
        const existente = await buscarPorAlias(aliasInput)
        if (existente.cbu !== cuenta.cbu) {
          setAliasError('Ese alias ya está en uso por otra cuenta')
          setSavingAlias(false)
          return
        }
      } catch {
        // alias no encontrado en la API → disponible
      }
      await asignarAlias(cuenta.cbu, aliasInput)
      const { error } = await supabase.from('cuentas').update({ alias: aliasInput }).eq('id', cuenta.id)
      if (error) throw error
      setCuenta({ ...cuenta, alias: aliasInput })
      toast.success('Alias actualizado correctamente')
    } catch {
      toast.error('No se pudo actualizar el alias')
    }
    setSavingAlias(false)
  }

  async function handleSaveCredito(e: React.FormEvent) {
    e.preventDefault()
    if (!persona) return
    setSavingCredito(true)

    const ingresoNum = ingresoMensual.trim() === '' ? null : parseFloat(ingresoMensual)
    const { error } = await supabase
      .from('personas')
      .update({ sueldo_acreditado: sueldoAcreditado, ingreso_mensual: ingresoNum })
      .eq('id', persona.id)

    if (!error) {
      setPersona({ ...persona, sueldo_acreditado: sueldoAcreditado, ingreso_mensual: ingresoNum })
      toast.success('Datos financieros actualizados')
    } else {
      toast.error('No se pudieron guardar los datos financieros')
    }
    setSavingCredito(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPassError('')

    if (newPass.length < 6) {
      setPassError('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }

    setSavingPass(true)

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: persona!.email,
      password: currentPass,
    })
    if (verifyError) {
      setPassError('La contraseña actual es incorrecta')
      setSavingPass(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (!error) {
      toast.success('Contraseña actualizada correctamente')
      setCurrentPass('')
      setNewPass('')
    } else {
      setPassError('No se pudo actualizar la contraseña')
    }
    setSavingPass(false)
  }

  async function toggleBiometria() {
    if (!user || !persona) return
    if (bioActiva) {
      setSavingBio(true)
      try {
        desactivarBiometria(user.id)
        setBioActiva(false)
        borrarCredencialBio(persona.email)
        borrarNombreBio(persona.email)
        toast.success('Biometría desactivada')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo desactivar'
        toast.error(msg)
      } finally {
        setSavingBio(false)
      }
      return
    }
    // Activar pide confirmar la contraseña una vez — se guarda localmente
    // (sólo para esta cuenta, sólo en este dispositivo) para poder saltear
    // el campo de contraseña en el login cuando la biometría valide.
    setConfirmError('')
    setConfirmPass('')
    setConfirmandoBio(true)
  }

  async function confirmarYActivar() {
    if (!user || !persona) return
    setSavingBio(true)
    setConfirmError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: persona.email, password: confirmPass })
      if (error) {
        setConfirmError('Contraseña incorrecta')
        return
      }
      toast.loading('Confirmá con la huella, la cara o el PIN del teléfono…', { id: 'bio' })
      await activarBiometria(user.id, `${persona.nombre} ${persona.apellido}`)
      guardarCredencialBio(persona.email, confirmPass)
      guardarNombreBio(persona.email, persona.nombre)
      setBioActiva(true)
      toast.success(
        'Biometría activada. Al entrar te la pedimos primero, con la contraseña como respaldo.',
        { id: 'bio' },
      )
      setConfirmandoBio(false)
      setConfirmPass('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo configurar el desbloqueo'
      toast.error(msg, { id: 'bio' })
    } finally {
      setSavingBio(false)
    }
  }

  async function permitirDispositivos() {
    setSavingPermisos(true)
    try {
      await pedirTodosLosPermisos()
      localStorage.setItem('monix_permisos_ok', '1')
      toast.success('Listo. Si Android no preguntó, abrí Ajustes → Apps → Monix → Permisos.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron pedir los permisos')
    } finally {
      setSavingPermisos(false)
    }
  }

  if (!persona) return null

  return (
    <PageWrapper>
      <div className="max-w-lg mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white mb-6">Perfil</h1>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Foto de perfil"
                className="w-24 h-24 rounded-full object-cover ring-4 ring-white dark:ring-navy-card shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-mint/20 ring-4 ring-white dark:ring-navy-card shadow-md flex items-center justify-center">
                <span className="font-display text-2xl font-bold text-mint">{initials}</span>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Cambiar foto"
            >
              <Camera size={22} className="text-white" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="font-body text-xs text-mint hover:text-mint-hover transition-colors"
            >
              {avatarUrl ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {avatarUrl && user && (
              <>
                <span className="text-slate-200 dark:text-white/10">|</span>
                <button
                  onClick={() => { removePhoto(user.id); toast.success('Foto eliminada') }}
                  className="font-body text-xs text-slate-secondary hover:text-red-400 transition-colors"
                >
                  Eliminar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Badge verificado */}
        <Card className="p-5 flex items-center gap-3 mb-6">
          <BadgeCheck size={24} className="text-mint shrink-0" />
          <div>
            <p className="font-body font-medium text-navy dark:text-white text-sm">Cuenta verificada</p>
            <p className="font-body text-xs text-slate-secondary">Tu identidad fue verificada correctamente</p>
          </div>
        </Card>

        <Card className="p-5 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <ShieldCheck size={22} className="text-mint shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-body font-medium text-navy dark:text-white text-sm">Permisos del teléfono</p>
              <p className="font-body text-xs text-slate-secondary mt-0.5">
                Cámara, micrófono, NFC y Bluetooth. Sin esto no abre el QR ni Cerca.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            loading={savingPermisos}
            onClick={() => { void permitirDispositivos() }}
            className="w-full"
          >
            Permitir cámara, micrófono y NFC
          </Button>
        </Card>

        <Card className="p-5 mb-6">
          <div className="flex items-start gap-3">
            <Fingerprint size={22} className="text-mint shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-body font-medium text-navy dark:text-white text-sm">Ingreso con biometría</p>
              <p className="font-body text-xs text-slate-secondary mt-0.5">
                {huellaDisponible
                  ? 'Usa la huella, la cara o el PIN que ya tengas configurado en el teléfono — el sistema elige solo cuál pedirte. Si sale mal o preferís no usarla, siempre podés entrar con tu contraseña.'
                  : 'Abrí Perfil desde el celular para activar la biometría.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={bioActiva}
              disabled={!huellaDisponible}
              aria-busy={savingBio}
              onClick={() => { if (!savingBio) void toggleBiometria() }}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${
                bioActiva ? 'bg-mint' : 'bg-slate-300 dark:bg-white/15'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  bioActiva ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Datos personales */}
        <Card className="p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Datos personales</h2>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="text-sm font-body text-mint hover:text-mint-hover transition-colors"
              >
                Editar
              </button>
            )}
          </div>

          {editMode ? (
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input label="Teléfono" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" type="button" onClick={() => setEditMode(false)} disabled={savingProfile}>
                  Cancelar
                </Button>
                <Button className="flex-1" type="submit" loading={savingProfile}>
                  Guardar
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              {[
                { label: 'Nombre', value: `${persona.nombre} ${persona.apellido}` },
                { label: 'DNI', value: persona.dni },
                { label: 'Email', value: persona.email },
                { label: 'Teléfono', value: persona.telefono ?? '—' },
                { label: 'Fecha de nacimiento', value: persona.fecha_nac ? new Date(persona.fecha_nac + 'T00:00:00').toLocaleDateString('es-AR') : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="font-body text-sm text-slate-secondary">{label}</span>
                  <span className="font-body text-sm text-navy dark:text-white">{value}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Alias de cuenta */}
        <Card className="p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <AtSign size={18} className="text-slate-secondary" />
              <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Alias de cuenta</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowData((v) => !v)}
              className="text-slate-secondary hover:text-navy dark:hover:text-white transition-colors"
              aria-label={showData ? 'Ocultar CBU y alias' : 'Mostrar CBU y alias'}
            >
              {showData ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <form onSubmit={handleSaveAlias} className="flex flex-col gap-4">
            <div>
              <Input
                label="Alias"
                type={showData ? 'text' : 'password'}
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="palabra.palabra.palabra"
                required
              />
              <p className="text-xs text-slate-secondary font-body mt-1">
                CBU: {showData ? (cuenta?.cbu ?? '—') : '•••••••••••••••••••••'}
              </p>
            </div>
            {aliasError && <p className="text-sm text-red-500 dark:text-red-400 font-body">{aliasError}</p>}
            <Button type="submit" loading={savingAlias} className="w-full">
              Guardar alias
            </Button>
          </form>
        </Card>

        {/* Datos financieros (ficticios, usados por Préstamos) */}
        <Card className="p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Wallet size={18} className="text-slate-secondary" />
            <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Datos financieros</h2>
          </div>
          <p className="font-body text-xs text-slate-secondary mb-6">
            Ficticios — los usamos para calcular tu oferta en Préstamos.
          </p>
          <form onSubmit={handleSaveCredito} className="flex flex-col gap-4">
            <label className="flex items-center justify-between rounded-xl bg-slate-input dark:bg-white/5 px-4 py-3 cursor-pointer">
              <span>
                <span className="block font-body text-sm text-navy dark:text-white">Cobro mi sueldo en Monix</span>
                <span className="block font-body text-xs text-slate-secondary">Mejora la tasa y el monto máximo en Préstamos</span>
              </span>
              <input
                type="checkbox"
                checked={sueldoAcreditado}
                onChange={(e) => setSueldoAcreditado(e.target.checked)}
                className="h-5 w-5 accent-mint shrink-0"
              />
            </label>
            <Input
              label="Ingreso mensual declarado"
              type="number"
              min="0"
              step="1000"
              placeholder="0"
              value={ingresoMensual}
              onChange={(e) => setIngresoMensual(e.target.value)}
            />
            <Button type="submit" loading={savingCredito} className="w-full">
              Guardar
            </Button>
          </form>
        </Card>

        {/* Cambiar contraseña */}
        <Card className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <Lock size={18} className="text-slate-secondary" />
            <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Cambiar contraseña</h2>
          </div>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <Input
              label="Contraseña actual"
              type="password"
              placeholder="••••••••"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              required
            />
            <Input
              label="Nueva contraseña"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              required
              minLength={6}
            />
            {passError && <p className="text-sm text-red-500 dark:text-red-400 font-body">{passError}</p>}
            <Button type="submit" loading={savingPass} className="w-full">
              Actualizar contraseña
            </Button>
          </form>
        </Card>
      </div>

      <Modal open={confirmandoBio} onClose={() => setConfirmandoBio(false)}>
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold text-navy dark:text-white mb-1">
            Confirmá tu contraseña
          </h3>
          <p className="font-body text-sm text-slate-secondary mb-4">
            La necesitamos una vez para activar el ingreso con biometría en este dispositivo.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); void confirmarYActivar() }}
            className="flex flex-col gap-3"
          >
            <Input
              label="Contraseña de Monix"
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              required
              autoFocus
            />
            {confirmError && <p className="text-sm text-red-500 dark:text-red-400 font-body">{confirmError}</p>}
            <div className="flex gap-2 mt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setConfirmandoBio(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={savingBio} className="flex-1">
                Confirmar
              </Button>
            </div>
          </form>
        </Card>
      </Modal>
    </PageWrapper>
  )
}
