import { useState, useRef } from 'react'
import { BadgeCheck, Lock, AtSign, Camera, Eye, EyeOff } from 'lucide-react'
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

  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [savingPass, setSavingPass] = useState(false)
  const [passError, setPassError] = useState('')

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
    </PageWrapper>
  )
}
