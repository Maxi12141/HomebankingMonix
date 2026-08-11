import { useState } from 'react';
import { ArrowRight, Check, AlertCircle } from 'lucide-react';

interface Transaction {
  type: 'income' | 'expense' | 'transfer';
  description: string;
  from: string;
  amount: number;
  date: string;
  time: string;
}

interface TransferPageProps {
  balance: number;
  onBack: () => void;
  onTransferComplete: (transaction: Omit<Transaction, 'id' | 'balance'>) => void;
}

export function TransferPage({ balance, onBack, onTransferComplete }: TransferPageProps) {
  const [step, setStep] = useState<'form' | 'confirm' | 'success' | 'error'>('form');
  const [formData, setFormData] = useState({
    fromAccount: 'ES91 2100 0418 4502 0005 1332',
    toAccount: '',
    amount: '',
    concept: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('confirm');
  };

  const handleConfirm = () => {
    const now = new Date();
    onTransferComplete({
      type: 'transfer',
      description: 'Transferencia enviada',
      from: formData.toAccount,
      amount: -parseFloat(formData.amount),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().substring(0, 5)
    });
    setTimeout(() => {
      setStep('success');
    }, 1000);
  };

  const handleNewTransfer = () => {
    setFormData({
      fromAccount: 'ES91 2100 0418 4502 0005 1332',
      toAccount: '',
      amount: '',
      concept: ''
    });
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
            Transferencia exitosa
          </h2>
          <p className="text-muted-foreground mb-6 font-['Inter']">
            Se ha transferido ${formData.amount} correctamente
          </p>

          <div className="bg-[#F0F2F5] rounded-xl p-4 mb-6 space-y-2 text-left">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-['Inter']">Cuenta destino</span>
              <span className="text-sm text-[#001A3D] font-['Inter'] font-medium">{formData.toAccount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-['Inter']">Monto</span>
              <span className="text-sm text-[#001A3D] font-['Inter'] font-medium">${formData.amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground font-['Inter']">Concepto</span>
              <span className="text-sm text-[#001A3D] font-['Inter'] font-medium">{formData.concept || 'Sin concepto'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleNewTransfer}
              className="w-full py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
            >
              Nueva transferencia
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
            Confirmar transferencia
          </h2>

          <div className="space-y-4 mb-8">
            <div className="bg-[#F0F2F5] rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-1 font-['Inter']">Desde</p>
              <p className="text-[#001A3D] font-['Inter'] font-medium">{formData.fromAccount}</p>
            </div>

            <div className="flex justify-center">
              <ArrowRight size={24} className="text-[#26FFC1]" />
            </div>

            <div className="bg-[#F0F2F5] rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-1 font-['Inter']">Hacia</p>
              <p className="text-[#001A3D] font-['Inter'] font-medium">{formData.toAccount}</p>
            </div>

            <div className="bg-[#001A3D] rounded-xl p-6 text-white text-center">
              <p className="text-sm opacity-80 mb-2 font-['Inter']">Monto a transferir</p>
              <p className="text-4xl font-['Plus_Jakarta_Sans'] font-semibold">${formData.amount}</p>
            </div>

            {formData.concept && (
              <div className="bg-[#F0F2F5] rounded-xl p-4">
                <p className="text-sm text-muted-foreground mb-1 font-['Inter']">Concepto</p>
                <p className="text-[#001A3D] font-['Inter']">{formData.concept}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={handleConfirm}
              className="w-full py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
            >
              Confirmar transferencia
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
          Nueva transferencia
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="fromAccount" className="block mb-2 text-[#001A3D] font-['Inter']">
              Desde tu cuenta
            </label>
            <div className="w-full px-4 py-3 rounded-xl bg-[#F0F2F5] border border-transparent font-['Inter']">
              {formData.fromAccount}
            </div>
            <p className="text-sm text-muted-foreground mt-2 font-['Inter']">
              Saldo disponible: ${balance.toFixed(2)}
            </p>
          </div>

          <div>
            <label htmlFor="toAccount" className="block mb-2 text-[#001A3D] font-['Inter']">
              Cuenta destino *
            </label>
            <input
              id="toAccount"
              type="text"
              value={formData.toAccount}
              onChange={(e) => setFormData({ ...formData, toAccount: e.target.value })}
              placeholder="ES00 0000 0000 0000 0000 0000"
              className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
              required
            />
          </div>

          <div>
            <label htmlFor="amount" className="block mb-2 text-[#001A3D] font-['Inter']">
              Monto *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-['Inter']">
                $
              </span>
              <input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-3 pl-8 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="concept" className="block mb-2 text-[#001A3D] font-['Inter']">
              Concepto (opcional)
            </label>
            <input
              id="concept"
              type="text"
              value={formData.concept}
              onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
              placeholder="Pago de servicios, regalo, etc."
              className="w-full px-4 py-3 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
            />
          </div>

          <div className="bg-[#26FFC1]/10 border border-[#26FFC1]/20 rounded-xl p-4 flex gap-3">
            <AlertCircle size={20} className="text-[#001A3D] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#001A3D] font-['Inter']">
              Verifica que los datos sean correctos antes de confirmar. Las transferencias son irreversibles.
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
