import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { MonixLogo } from './MonixLogo';
import { RegisterForm } from './RegisterForm';

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

interface LoginPageProps {
  onLogin: (username: string, password: string) => void;
  onRegister: (userData: UserData) => void;
}

export function LoginPage({ onLogin, onRegister }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left side - Login/Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white overflow-y-auto">
        {showRegister ? (
          <RegisterForm onRegister={onRegister} onBackToLogin={() => setShowRegister(false)} />
        ) : (
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-12">
            <MonixLogo size="lg" className="mb-2" />
            <p className="text-muted-foreground font-['Inter']">Bienvenido de vuelta</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block mb-2 text-[#001A3D] font-['Inter']">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu nombre de usuario"
                className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block mb-2 text-[#001A3D] font-['Inter']">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border accent-[#26FFC1]"
                />
                <span className="text-sm text-muted-foreground font-['Inter']">Recordarme</span>
              </label>
              <button
                type="button"
                className="text-sm text-[#001A3D] hover:text-[#26FFC1] transition-colors font-['Inter']"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
            >
              Iniciar sesión
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-muted-foreground font-['Inter']">O continúa con</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className="py-3 px-4 border border-border rounded-xl hover:bg-accent transition-colors flex items-center justify-center gap-2 font-['Inter']"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </button>
              <button
                type="button"
                className="py-3 px-4 border border-border rounded-xl hover:bg-accent transition-colors flex items-center justify-center gap-2 font-['Inter']"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
                GitHub
              </button>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-8 font-['Inter']">
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => setShowRegister(true)}
                className="text-[#001A3D] hover:text-[#26FFC1] transition-colors font-medium"
              >
                Regístrate
              </button>
            </p>
          </form>
        </div>
        )}
      </div>

      {/* Right side - Brand Background */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#001A3D] items-center justify-center p-12 relative overflow-hidden">
        {/* Subtle gradient accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#001A3D] via-[#001A3D] to-[#002952] opacity-80"></div>

        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-[#26FFC1] rounded-full opacity-5 blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-48 h-48 bg-[#26FFC1] rounded-full opacity-5 blur-3xl"></div>

        <div className="max-w-lg text-white relative z-10">
          <h2 className="text-5xl mb-6 font-['Plus_Jakarta_Sans'] font-semibold">Tu banco digital</h2>
          <p className="text-xl opacity-90 mb-8 font-['Inter']">
            Gestiona tus finanzas de manera simple, segura y desde cualquier lugar.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#26FFC1]/20 flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-5 h-5 text-[#26FFC1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-['Plus_Jakarta_Sans'] font-medium">Seguridad garantizada</h3>
                <p className="text-white/80 font-['Inter']">Protección de última generación para tus datos</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#26FFC1]/20 flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-5 h-5 text-[#26FFC1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-['Plus_Jakarta_Sans'] font-medium">Sin comisiones ocultas</h3>
                <p className="text-white/80 font-['Inter']">Transparencia total en cada operación</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#26FFC1]/20 flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-5 h-5 text-[#26FFC1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-['Plus_Jakarta_Sans'] font-medium">Disponible 24/7</h3>
                <p className="text-white/80 font-['Inter']">Accede a tu cuenta cuando lo necesites</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
