import { useState, useRef } from 'react';
import { User, Mail, Phone, Calendar, CreditCard, Shield, Save, Edit2, X, Eye, EyeOff, Lock, Camera } from 'lucide-react';

interface UserData {
  username: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone: string;
  birthDate: string;
  password: string;
  profilePhoto?: string;
}

interface ProfilePageProps {
  userData: UserData;
  onBack: () => void;
  onUpdateProfile: (updatedData: Partial<UserData>) => void;
}

export function ProfilePage({ userData, onBack, onUpdateProfile }: ProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editData, setEditData] = useState(userData);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const photoUrl = reader.result as string;
        onUpdateProfile({ profilePhoto: photoUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onUpdateProfile(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(userData);
    setIsEditing(false);
  };

  const handleChangePassword = () => {
    if (passwordData.currentPassword !== userData.password) {
      alert('La contraseña actual es incorrecta');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Las contraseñas nuevas no coinciden');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      alert('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    onUpdateProfile({ password: passwordData.newPassword });
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowChangePassword(false);
    alert('Contraseña actualizada correctamente');
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-[#001A3D] transition-colors mb-4 font-['Inter']"
          >
            ← Volver al inicio
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl text-[#001A3D] font-['Plus_Jakarta_Sans'] font-semibold">
              Mi perfil
            </h1>
            {!isEditing && !showChangePassword && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all font-['Inter'] font-medium"
              >
                <Edit2 size={18} />
                Editar perfil
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border text-center">
              <div className="relative w-24 h-24 mx-auto mb-4 group">
                {userData.profilePhoto ? (
                  <img
                    src={userData.profilePhoto}
                    alt="Foto de perfil"
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-[#001A3D] to-[#002952] rounded-full flex items-center justify-center">
                    <User size={40} className="text-white" />
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-[#26FFC1] hover:bg-[#1FE6AF] rounded-full flex items-center justify-center transition-all shadow-lg"
                >
                  <Camera size={16} className="text-[#001A3D]" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
              <h2 className="text-xl text-[#001A3D] mb-1 font-['Plus_Jakarta_Sans'] font-semibold">
                {userData.username}
              </h2>
              <p className="text-sm text-muted-foreground mb-4 font-['Inter']">
                Cliente Monix
              </p>
              <div className="bg-[#F0F2F5] rounded-xl p-3 mb-4">
                <p className="text-xs text-muted-foreground mb-1 font-['Inter']">ID de cliente</p>
                <p className="text-sm text-[#001A3D] font-['Inter'] font-medium">MX-2024-{userData.username.substring(0, 4).toUpperCase()}</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-[#26FFC1]">
                <Shield size={16} />
                <span className="text-sm font-['Inter'] font-medium">Cuenta verificada</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {!showChangePassword ? (
              <>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-border mb-6">
                  <h3 className="text-xl text-[#001A3D] mb-6 font-['Plus_Jakarta_Sans'] font-semibold">
                    Información personal
                  </h3>

                  <div className="space-y-6">
                    <div>
                      <label className="block mb-2 text-sm text-muted-foreground font-['Inter']">
                        <div className="flex items-center gap-2 mb-2">
                          <User size={16} />
                          Nombre de usuario
                        </div>
                      </label>
                      <p className="text-[#001A3D] font-['Inter'] font-medium px-4 py-3 bg-[#F0F2F5] rounded-xl">
                        {userData.username}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 font-['Inter']">
                        El nombre de usuario no puede modificarse
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block mb-2 text-sm text-muted-foreground font-['Inter']">
                          <div className="flex items-center gap-2 mb-2">
                            <User size={16} />
                            Nombre
                          </div>
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.firstName}
                            onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                            placeholder="Tu nombre"
                            className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
                          />
                        ) : (
                          <p className="text-[#001A3D] font-['Inter'] font-medium px-4 py-3">
                            {userData.firstName || 'No especificado'}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block mb-2 text-sm text-muted-foreground font-['Inter']">
                          <div className="flex items-center gap-2 mb-2">
                            <User size={16} />
                            Apellido
                          </div>
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.lastName}
                            onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                            placeholder="Tu apellido"
                            className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
                          />
                        ) : (
                          <p className="text-[#001A3D] font-['Inter'] font-medium px-4 py-3">
                            {userData.lastName || 'No especificado'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block mb-2 text-sm text-muted-foreground font-['Inter']">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard size={16} />
                          DNI
                        </div>
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData.dni}
                          onChange={(e) => setEditData({ ...editData, dni: e.target.value })}
                          placeholder="12345678A"
                          className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
                        />
                      ) : (
                        <p className="text-[#001A3D] font-['Inter'] font-medium px-4 py-3">
                          {userData.dni || 'No especificado'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block mb-2 text-sm text-muted-foreground font-['Inter']">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail size={16} />
                          Correo electrónico
                        </div>
                      </label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editData.email}
                          onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                          placeholder="correo@ejemplo.com"
                          className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
                        />
                      ) : (
                        <p className="text-[#001A3D] font-['Inter'] font-medium px-4 py-3">
                          {userData.email || 'No especificado'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block mb-2 text-sm text-muted-foreground font-['Inter']">
                        <div className="flex items-center gap-2 mb-2">
                          <Phone size={16} />
                          Teléfono
                        </div>
                      </label>
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editData.phone}
                          onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                          placeholder="+34 600 000 000"
                          className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
                        />
                      ) : (
                        <p className="text-[#001A3D] font-['Inter'] font-medium px-4 py-3">
                          {userData.phone || 'No especificado'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block mb-2 text-sm text-muted-foreground font-['Inter']">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar size={16} />
                          Fecha de nacimiento
                        </div>
                      </label>
                      <p className="text-[#001A3D] font-['Inter'] font-medium px-4 py-3 bg-[#F0F2F5] rounded-xl">
                        {userData.birthDate ? new Date(userData.birthDate).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'No especificado'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 font-['Inter']">
                        La fecha de nacimiento no puede modificarse
                      </p>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex gap-3 mt-8">
                      <button
                        onClick={handleSave}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
                      >
                        <Save size={18} />
                        Guardar cambios
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-transparent border border-border hover:bg-accent text-[#001A3D] rounded-xl transition-all font-['Inter'] font-medium"
                      >
                        <X size={18} />
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
                  <h3 className="text-xl text-[#001A3D] mb-4 font-['Plus_Jakarta_Sans'] font-semibold">
                    Seguridad
                  </h3>
                  <div className="space-y-4">
                    <button
                      onClick={() => setShowChangePassword(true)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-accent transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <Lock size={20} className="text-muted-foreground" />
                        <div>
                          <p className="text-[#001A3D] font-['Inter'] font-medium">Cambiar contraseña</p>
                          <p className="text-sm text-muted-foreground font-['Inter']">
                            Actualiza tu contraseña de acceso
                          </p>
                        </div>
                      </div>
                      <span className="text-[#001A3D] group-hover:text-[#26FFC1] transition-colors">→</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
                <button
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="text-muted-foreground hover:text-[#001A3D] transition-colors mb-4 font-['Inter']"
                >
                  ← Volver
                </button>

                <h3 className="text-xl text-[#001A3D] mb-6 font-['Plus_Jakarta_Sans'] font-semibold">
                  Cambiar contraseña
                </h3>

                <div className="space-y-6">
                  <div>
                    <label htmlFor="currentPassword" className="block mb-2 text-[#001A3D] font-['Inter']">
                      Contraseña actual
                    </label>
                    <div className="relative">
                      <input
                        id="currentPassword"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all pr-12 font-['Inter']"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#001A3D] transition-colors"
                      >
                        {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="block mb-2 text-[#001A3D] font-['Inter']">
                      Nueva contraseña
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all pr-12 font-['Inter']"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#001A3D] transition-colors"
                      >
                        {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block mb-2 text-[#001A3D] font-['Inter']">
                      Confirmar nueva contraseña
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all pr-12 font-['Inter']"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#001A3D] transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#26FFC1]/10 border border-[#26FFC1]/20 rounded-xl p-4">
                    <p className="text-sm text-[#001A3D] font-['Inter']">
                      <strong>Requisitos de contraseña:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Mínimo 8 caracteres</li>
                        <li>Al menos una mayúscula</li>
                        <li>Al menos una minúscula</li>
                        <li>Al menos un número</li>
                      </ul>
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleChangePassword}
                      className="flex-1 py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
                    >
                      Actualizar contraseña
                    </button>
                    <button
                      onClick={() => {
                        setShowChangePassword(false);
                        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                      }}
                      className="flex-1 py-3 px-4 bg-transparent border border-border hover:bg-accent text-[#001A3D] rounded-xl transition-all font-['Inter'] font-medium"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
