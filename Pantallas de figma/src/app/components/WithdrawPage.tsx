import { useState } from 'react';
import { ArrowDownLeft, Check, AlertCircle } from 'lucide-react';

interface Transaction {
  type: 'income' | 'expense' | 'transfer';
  description: string;
  from: string;
  amount: number;
  date: string;
  time: string;
}

interface WithdrawPageProps {
  balance: number;
  onBack: () => void;
  onWithdrawComplete: (transaction: Omit<Transaction, 'id' | 'balance'>) => void;
}

export function WithdrawPage({ balance, onBack, onWithdrawComplete }: WithdrawPageProps) {
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [formData, setFormData] = useState({
    amount: '',
    method: 'atm'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('confirm');
  };

  const handleConfirm = () => {
    const now = new Date();
    onWithdrawComplete({
      type: 'expense',
      description: 'Retiro de efectivo',
      from: formData.method === 'atm' ? 'Cajero automático' : 'Sucursal bancaria',
      amount: -parseFloat(formData.amount),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().substring(0, 5)
    });
    setTimeout(() => {
      setStep('success');
    }, 1000);
  };

  const handleNewWithdraw = () => {
    setFormData({ amount: '', method: 'atm' });
    setStep('form');
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm border border-border">
          <div className="w-16 h-16 bg-[#26FFC1]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={32} className="text-[#26FFC1]" strokeWidth={3} />
          </div>
          <h2 className="text-2xl text-[#001A3D] mb-3 font-['Plus_Jakarta_Sans'] font-semibold">
            Retiro autorizado
          </h2>
          <p className="text-muted-foreground mb-6 font-['Inter']">
            Puedes retirar ${formData.amount} en {formData.method === 'atm' ? 'cajero automático' : 'sucursal bancaria'}
          </p>

          <div className="bg-[#F0F2F5] rounded-xl p-4 mb-6 space-y-2 text-left">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-['Inter']">Monto</span>
              <span className="text-sm text-[#001A3D] font-['Inter'] font-medium">${formData.amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-['Inter']">Método</span>
              <span className="text-sm text-[#001A3D] font-['Inter'] font-medium">
                {formData.method === 'atm' ? 'Cajero automático' : 'Sucursal bancaria'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-['Inter']">Código de retiro</span>
              <span className="text-sm text-[#001A3D] font-['Inter'] font-medium">#{Math.floor(100000 + Math.random() * 900000)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleNewWithdraw}
              className="w-full py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
            >
              Nuevo retiro
            </button>
            <button
              onClick={onBack}
              className="w-full py-3 px-4 bg-transparent border border-border hover:bg-accent text-[#001A3D] rounded-xl transition-all font-['Inter'] font-medium"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-border">
          <h2 className="text-2xl text-[#001A3D] mb-6 font-['Plus_Jakarta_Sans'] font-semibold">
            Confirmar retiro
          </h2>

          <div className="bg-[#001A3D] rounded-xl p-6 text-white text-center mb-6">
            <p className="text-sm opacity-80 mb-2 font-['Inter']">Monto a retirar</p>
            <p className="text-4xl font-['Plus_Jakarta_Sans'] font-semibold">${formData.amount}</p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="bg-[#F0F2F5] rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-1 font-['Inter']">Método de retiro</p>
              <p className="text-[#001A3D] font-['Inter'] font-medium">
                {formData.method === 'atm' ? 'Cajero automático' : 'Sucursal bancaria'}
              </p>
            </div>

            <div className="bg-[#F0F2F5] rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-1 font-['Inter']">Tu cuenta</p>
              <p className="text-[#001A3D] font-['Inter'] font-medium">ES91 2100 0418 4502 0005 1332</p>
            </div>

            <div className="bg-[#F0F2F5] rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-1 font-['Inter']">Nuevo saldo</p>
              <p className="text-[#001A3D] font-['Inter'] font-medium">
                ${(balance - parseFloat(formData.amount || '0')).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleConfirm}
              className="w-full py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
            >
              Confirmar retiro
            </button>
            <button
              onClick={() => setStep('form')}
              className="w-full py-3 px-4 bg-transparent border border-border hover:bg-accent text-[#001A3D] rounded-xl transition-all font-['Inter'] font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-border">
        <h2 className="text-2xl text-[#001A3D] mb-6 font-['Plus_Jakarta_Sans'] font-semibold">
          Retirar dinero
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-2 text-[#001A3D] font-['Inter']">
              Tu cuenta
            </label>
            <div className="w-full px-4 py-3 rounded-xl bg-[#F0F2F5] border border-transparent font-['Inter']">
              ES91 2100 0418 4502 0005 1332
            </div>
            <p className="text-sm text-muted-foreground mt-2 font-['Inter']">
              Saldo disponible: ${balance.toFixed(2)}
            </p>
          </div>

          <div>
            <label htmlFor="amount" className="block mb-2 text-[#001A3D] font-['Inter']">
              Monto a retirar *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-['Inter']">
                $
              </span>
              <input
                id="amount"
                type="number"
                step="0.01"
                max={balance}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-3 pl-8 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
                required
              />
            </div>
          </div>

          <div>
            <label className="block mb-2 text-[#001A3D] font-['Inter']">
              Método de retiro *
            </label>
            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                formData.method === 'atm'
                  ? 'border-[#26FFC1] bg-[#26FFC1]/5'
                  : 'border-border hover:bg-accent'
              }`}>
                <input
                  type="radio"
                  name="method"
                  value="atm"
                  checked={formData.method === 'atm'}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                  className="w-4 h-4 accent-[#26FFC1]"
                />
                <div className="flex-1">
                  <p className="text-[#001A3D] font-['Inter'] font-medium">Cajero automático</p>
                  <p className="text-sm text-muted-foreground font-['Inter']">Retira en cualquier cajero Monix</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                formData.method === 'branch'
                  ? 'border-[#26FFC1] bg-[#26FFC1]/5'
                  : 'border-border hover:bg-accent'
              }`}>
                <input
                  type="radio"
                  name="method"
                  value="branch"
                  checked={formData.method === 'branch'}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                  className="w-4 h-4 accent-[#26FFC1]"
                />
                <div className="flex-1">
                  <p className="text-[#001A3D] font-['Inter'] font-medium">Sucursal bancaria</p>
                  <p className="text-sm text-muted-foreground font-['Inter']">Retira en nuestras oficinas</p>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-[#26FFC1]/10 border border-[#26FFC1]/20 rounded-xl p-4 flex gap-3">
            <AlertCircle size={20} className="text-[#001A3D] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#001A3D] font-['Inter']">
              El retiro puede tardar hasta 24 horas en procesarse. Recibirás un código de confirmación.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              className="w-full py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
            >
              Continuar
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full py-3 px-4 bg-transparent border border-border hover:bg-accent text-[#001A3D] rounded-xl transition-all font-['Inter'] font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
