import { useState } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

interface UserData {
  username: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone: string;
  birthDate: string;
  password: string;
}

interface RegisterFormProps {
  onRegister: (userData: UserData) => void;
  onBackToLogin: () => void;
}

export function RegisterForm({ onRegister, onBackToLogin }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    firstName: '',
    lastName: '',
    dni: '',
    email: '',
    phone: '',
    birthDate: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegister(formData as UserData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="w-full max-w-2xl">
      <button
        onClick={onBackToLogin}
        className="flex items-center gap-2 text-muted-foreground hover:text-[#001A3D] transition-colors mb-6 font-['Inter']"
      >
        <ArrowLeft size={20} />
        Volver al inicio de sesión
      </button>

      <div className="mb-8">
        <h2 className="text-3xl text-[#001A3D] mb-2 font-['Plus_Jakarta_Sans'] font-semibold">
          Crear cuenta
        </h2>
        <p className="text-muted-foreground font-['Inter']">
          Completa tus datos para comenzar
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="username" className="block mb-2 text-[#001A3D] font-['Inter']">
            Nombre de usuario *
          </label>
          <input
            id="username"
            type="text"
            value={formData.username}
            onChange={(e) => handleChange('username', e.target.value)}
            placeholder="Tu nombre de usuario"
            className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="firstName" className="block mb-2 text-[#001A3D] font-['Inter']">
              Nombre *
            </label>
            <input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="Tu nombre"
              className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
              required
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block mb-2 text-[#001A3D] font-['Inter']">
              Apellido *
            </label>
            <input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder="Tu apellido"
              className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="dni" className="block mb-2 text-[#001A3D] font-['Inter']">
              DNI *
            </label>
            <input
              id="dni"
              type="text"
              value={formData.dni}
              onChange={(e) => handleChange('dni', e.target.value)}
              placeholder="12345678"
              className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
              required
            />
          </div>

          <div>
            <label htmlFor="birthDate" className="block mb-2 text-[#001A3D] font-['Inter']">
              Fecha de nacimiento *
            </label>
            <input
              id="birthDate"
              type="date"
              value={formData.birthDate}
              onChange={(e) => handleChange('birthDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block mb-2 text-[#001A3D] font-['Inter']">
            Correo electrónico *
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="tu@email.com"
            className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
            required
          />
        </div>

        <div>
          <label htmlFor="phone" className="block mb-2 text-[#001A3D] font-['Inter']">
            Teléfono *
          </label>
          <input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="+34 600 000 000"
            className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="password" className="block mb-2 text-[#001A3D] font-['Inter']">
              Contraseña *
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all pr-12 font-['Inter']"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#001A3D] transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block mb-2 text-[#001A3D] font-['Inter']">
              Confirmar contraseña *
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
              required
            />
          </div>
        </div>

        <div className="bg-[#26FFC1]/10 border border-[#26FFC1]/20 rounded-xl p-4">
          <p className="text-sm text-[#001A3D] font-['Inter']">
            Tu contraseña debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas y números.
          </p>
        </div>

        <button
          type="submit"
          className="w-full py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
        >
          Crear cuenta
        </button>

        <p className="text-xs text-muted-foreground text-center font-['Inter']">
          Al crear una cuenta, aceptas nuestros Términos de Servicio y Política de Privacidad
        </p>
      </form>
    </div>
  );
}
