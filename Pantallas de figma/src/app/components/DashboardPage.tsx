import { CreditCard, TrendingUp, TrendingDown, Send, ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Settings, LogOut, Bell, User } from 'lucide-react';
import { useState } from 'react';
import { MonixLogo } from './MonixLogo';

interface Transaction {
  id: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  from: string;
  amount: number;
  date: string;
  time: string;
  balance: number;
}

interface DashboardPageProps {
  username: string;
  profilePhoto?: string;
  balance: number;
  transactions: Transaction[];
  onLogout: () => void;
  onNavigate: (page: 'dashboard' | 'transfer' | 'history' | 'profile' | 'withdraw' | 'deposit') => void;
}

export function DashboardPage({ username, profilePhoto, balance, transactions, onLogout, onNavigate }: DashboardPageProps) {
  const [showBalance, setShowBalance] = useState(true);

  const recentTransactions = transactions.slice(0, 5);

  const monthlyIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpenses = Math.abs(transactions
    .filter(t => (t.type === 'expense' || t.type === 'transfer') && t.amount < 0 && new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + t.amount, 0));

  const oldTransactions = [
    {
      id: 1,
      type: 'income',
      description: 'Transferencia recibida',
      from: 'Juan Pérez',
      amount: 1250.00,
      date: '2026-04-20',
      time: '10:30'
    },
    {
      id: 2,
      type: 'expense',
      description: 'Pago de servicio',
      from: 'Netflix',
      amount: -15.99,
      date: '2026-04-19',
      time: '14:22'
    },
    {
      id: 3,
      type: 'expense',
      description: 'Compra',
      from: 'Amazon',
      amount: -89.50,
      date: '2026-04-19',
      time: '09:15'
    },
    {
      id: 4,
      type: 'income',
      description: 'Salario',
      from: 'Empresa XYZ',
      amount: 3500.00,
      date: '2026-04-18',
      time: '08:00'
    },
    {
      id: 5,
      type: 'expense',
      description: 'Supermercado',
      from: 'Mercadona',
      amount: -125.30,
      date: '2026-04-17',
      time: '18:45'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      {/* Header */}
      <header className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <MonixLogo size="md" />

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-accent rounded-xl transition-colors relative">
              <Bell size={20} className="text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#26FFC1] rounded-full"></span>
            </button>
            <button
              onClick={() => onNavigate('profile')}
              className="hover:opacity-80 transition-opacity"
            >
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Perfil"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#001A3D] to-[#002952] flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
              )}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 hover:bg-accent rounded-xl transition-colors"
            >
              <LogOut size={18} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-['Inter']">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl text-[#001A3D] mb-1 font-['Plus_Jakarta_Sans']">
            Bienvenido, {username}
          </h2>
          <p className="text-muted-foreground font-['Inter']">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Main Balance Card */}
          <div className="md:col-span-2 bg-[#001A3D] rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
            {/* Subtle accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#26FFC1] rounded-full opacity-5 blur-3xl"></div>

            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <p className="text-white/80 mb-2 font-['Inter']">Saldo disponible</p>
                <div className="flex items-center gap-3">
                  {showBalance ? (
                    <h3 className="text-5xl font-['Plus_Jakarta_Sans'] font-semibold">${balance.toFixed(2)}</h3>
                  ) : (
                    <h3 className="text-5xl font-['Plus_Jakarta_Sans'] font-semibold">$••••••</h3>
                  )}
                  <button
                    onClick={() => setShowBalance(!showBalance)}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    {showBalance ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <CreditCard size={40} className="opacity-40" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/20 relative z-10">
              <div>
                <p className="text-white/80 text-sm mb-1 font-['Inter']">Número de cuenta</p>
                <p className="tracking-wide font-['Inter']">ES91 2100 0418 4502 0005 1332</p>
              </div>
              <div>
                <p className="text-white/80 text-sm mb-1 font-['Inter']">Tarjeta</p>
                <p className="tracking-wide font-['Inter']">•••• •••• •••• 4521</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#26FFC1]/20 flex items-center justify-center">
                  <TrendingUp size={20} className="text-[#26FFC1]" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-['Inter']">Ingresos</p>
                  <p className="text-xl text-[#001A3D] font-['Plus_Jakarta_Sans'] font-semibold">${monthlyIncome.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-xs text-[#26FFC1] font-['Inter']">Este mes</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <TrendingDown size={20} className="text-red-600" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-['Inter']">Gastos</p>
                  <p className="text-xl text-[#001A3D] font-['Plus_Jakarta_Sans'] font-semibold">${monthlyExpenses.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-xs text-red-600 font-['Inter']">Este mes</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border mb-8">
          <h3 className="mb-6 text-[#001A3D] font-['Plus_Jakarta_Sans']">Acciones rápidas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => onNavigate('transfer')}
              className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-accent transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-[#26FFC1]/10 flex items-center justify-center group-hover:bg-[#26FFC1]/20 transition-colors">
                <Send size={24} className="text-[#001A3D]" strokeWidth={2} />
              </div>
              <span className="text-sm text-[#001A3D] font-['Inter']">Transferir</span>
            </button>

            <button
              onClick={() => onNavigate('withdraw')}
              className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-accent transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-[#26FFC1]/10 flex items-center justify-center group-hover:bg-[#26FFC1]/20 transition-colors">
                <ArrowDownLeft size={24} className="text-[#001A3D]" strokeWidth={2} />
              </div>
              <span className="text-sm text-[#001A3D] font-['Inter']">Retirar</span>
            </button>

            <button
              onClick={() => onNavigate('deposit')}
              className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-accent transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-[#26FFC1]/10 flex items-center justify-center group-hover:bg-[#26FFC1]/20 transition-colors">
                <ArrowUpRight size={24} className="text-[#001A3D]" strokeWidth={2} />
              </div>
              <span className="text-sm text-[#001A3D] font-['Inter']">Depositar</span>
            </button>

            <button
              onClick={() => onNavigate('history')}
              className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-accent transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-[#26FFC1]/10 flex items-center justify-center group-hover:bg-[#26FFC1]/20 transition-colors">
                <CreditCard size={24} className="text-[#001A3D]" strokeWidth={2} />
              </div>
              <span className="text-sm text-[#001A3D] font-['Inter']">Historial</span>
            </button>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[#001A3D] font-['Plus_Jakarta_Sans']">Transacciones recientes</h3>
            <button
              onClick={() => onNavigate('history')}
              className="text-sm text-[#001A3D] hover:text-[#26FFC1] transition-colors font-['Inter'] font-medium"
            >
              Ver todas
            </button>
          </div>

          <div className="space-y-1">
            {recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      transaction.type === 'income'
                        ? 'bg-[#26FFC1]/20'
                        : 'bg-red-100'
                    }`}
                  >
                    {transaction.type === 'income' ? (
                      <ArrowDownLeft size={20} className="text-[#26FFC1]" strokeWidth={2.5} />
                    ) : (
                      <ArrowUpRight size={20} className="text-red-600" strokeWidth={2.5} />
                    )}
                  </div>
                  <div>
                    <p className="text-[#001A3D] mb-1 font-['Inter'] font-medium">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground font-['Inter']">{transaction.from}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`mb-1 font-['Plus_Jakarta_Sans'] font-semibold ${
                      transaction.type === 'income'
                        ? 'text-[#26FFC1]'
                        : 'text-[#001A3D]'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : ''}$
                    {Math.abs(transaction.amount).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground font-['Inter']">
                    {transaction.date} · {transaction.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
