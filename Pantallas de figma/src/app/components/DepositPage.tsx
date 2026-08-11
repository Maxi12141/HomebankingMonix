import { useState } from 'react';
import { ArrowUpRight, Check, AlertCircle, Copy } from 'lucide-react';

interface Transaction {
  type: 'income' | 'expense' | 'transfer';
  description: string;
  from: string;
  amount: number;
  date: string;
  time: string;
}

interface DepositPageProps {
  onBack: () => void;
  onDepositComplete: (transaction: Omit<Transaction, 'id' | 'balance'>) => void;
}

export function DepositPage({ onBack, onDepositComplete }: DepositPageProps) {
  const [step, setStep] = useState<'method' | 'instructions' | 'success' | 'amount'>('method');
  const [method, setMethod] = useState<'transfer' | 'cash' | 'check'>('transfer');
  const [copied, setCopied] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  const handleCopyAccount = () => {
    navigator.clipboard.writeText('ES91 2100 0418 4502 0005 1332');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm border border-border">
          <div className="w-16 h-16 bg-[#26FFC1]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={32} className="text-[#26FFC1]" strokeWidth={3} />
          </div>
          <h2 className="text-2xl text-[#001A3D] mb-3 font-['Plus_Jakarta_Sans'] font-semibold">
            Instrucciones enviadas
          </h2>
          <p className="text-muted-foreground mb-6 font-['Inter']">
            Hemos enviado las instrucciones de depósito a tu correo electrónico
          </p>

          <div className="space-y-3">
            <button
              onClick={() => setStep('method')}
              className="w-full py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
            >
              Nuevo depósito
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

  if (step === 'amount') {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-border">
          <h2 className="text-2xl text-[#001A3D] mb-6 font-['Plus_Jakarta_Sans'] font-semibold">
            Simular depósito
          </h2>

          <p className="text-muted-foreground mb-6 font-['Inter']">
            Ingresa el monto que deseas depositar para simularlo en tu cuenta
          </p>

          <div className="mb-6">
            <label htmlFor="depositAmount" className="block mb-2 text-[#001A3D] font-['Inter']">
              Monto a depositar
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-['Inter']">
                $
              </span>
              <input
                id="depositAmount"
                type="number"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 pl-8 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
              />
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                if (depositAmount && parseFloat(depositAmount) > 0) {
                  const now = new Date();
                  onDepositComplete({
                    type: 'income',
                    description: 'Depósito',
                    from: method === 'transfer' ? 'Transferencia bancaria' : method === 'cash' ? 'Efectivo' : 'Cheque',
                    amount: parseFloat(depositAmount),
                    date: now.toISOString().split('T')[0],
                    time: now.toTimeString().substring(0, 5)
                  });
                  setStep('success');
                } else {
                  alert('Por favor ingresa un monto válido');
                }
              }}
              className="w-full py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
            >
              Confirmar depósito
            </button>
            <button
              onClick={() => setStep('instructions')}
              className="w-full py-3 px-4 bg-transparent border border-border hover:bg-accent text-[#001A3D] rounded-xl transition-all font-['Inter'] font-medium"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'instructions') {
    return (
      <div className="min-h-screen bg-[#F0F2F5] p-6">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setStep('method')}
            className="text-muted-foreground hover:text-[#001A3D] transition-colors mb-4 font-['Inter']"
          >
            ← Volver
          </button>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-border">
            <h2 className="text-2xl text-[#001A3D] mb-6 font-['Plus_Jakarta_Sans'] font-semibold">
              Instrucciones para depositar
            </h2>

            {method === 'transfer' && (
              <div className="space-y-6">
                <div className="bg-[#001A3D] rounded-xl p-6 text-white">
                  <p className="text-sm opacity-80 mb-2 font-['Inter']">Número de cuenta Monix</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-['Plus_Jakarta_Sans'] font-semibold">ES91 2100 0418 4502 0005 1332</p>
                    <button
                      onClick={handleCopyAccount}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {copied ? <Check size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg text-[#001A3D] font-['Plus_Jakarta_Sans'] font-medium">
                    Pasos a seguir:
                  </h3>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">1</span>
                      <p className="text-[#001A3D] font-['Inter']">Ingresa a tu banco o aplicación bancaria</p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">2</span>
                      <p className="text-[#001A3D] font-['Inter']">Selecciona la opción de transferencia o envío de dinero</p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">3</span>
                      <p className="text-[#001A3D] font-['Inter']">Ingresa el número de cuenta de Monix mostrado arriba</p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">4</span>
                      <p className="text-[#001A3D] font-['Inter']">Ingresa el monto que deseas depositar</p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">5</span>
                      <p className="text-[#001A3D] font-['Inter']">Confirma la transferencia</p>
                    </li>
                  </ol>
                </div>

                <div className="bg-[#26FFC1]/10 border border-[#26FFC1]/20 rounded-xl p-4">
                  <p className="text-sm text-[#001A3D] font-['Inter']">
                    <strong>Nota:</strong> El dinero estará disponible en tu cuenta Monix en un plazo de 24-48 horas hábiles.
                  </p>
                </div>
              </div>
            )}

            {method === 'cash' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg text-[#001A3D] font-['Plus_Jakarta_Sans'] font-medium">
                    Depósito en efectivo:
                  </h3>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">1</span>
                      <p className="text-[#001A3D] font-['Inter']">Dirígete a cualquier sucursal Monix</p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">2</span>
                      <p className="text-[#001A3D] font-['Inter']">Presenta tu DNI y número de cuenta</p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">3</span>
                      <p className="text-[#001A3D] font-['Inter']">Entrega el efectivo al cajero</p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">4</span>
                      <p className="text-[#001A3D] font-['Inter']">Recibirás un comprobante de depósito</p>
                    </li>
                  </ol>
                </div>

                <div className="bg-[#001A3D] rounded-xl p-6 text-white">
                  <p className="text-sm opacity-80 mb-2 font-['Inter']">Tu número de cuenta</p>
                  <p className="text-xl font-['Plus_Jakarta_Sans'] font-semibold">ES91 2100 0418 4502 0005 1332</p>
                </div>

                <div className="bg-[#26FFC1]/10 border border-[#26FFC1]/20 rounded-xl p-4">
                  <p className="text-sm text-[#001A3D] font-['Inter']">
                    <strong>Horario de atención:</strong> Lunes a Viernes de 9:00 a 18:00
                  </p>
                </div>
              </div>
            )}

            {method === 'check' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg text-[#001A3D] font-['Plus_Jakarta_Sans'] font-medium">
                    Depósito con cheque:
                  </h3>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">1</span>
                      <p className="text-[#001A3D] font-['Inter']">Endosa el cheque a nombre de Monix</p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">2</span>
                      <p className="text-[#001A3D] font-['Inter']">Escribe tu número de cuenta al reverso</p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-[#26FFC1] text-[#001A3D] rounded-full flex items-center justify-center text-sm font-['Inter'] font-semibold">3</span>
                      <p className="text-[#001A3D] font-['Inter']">Deposita el cheque en cualquier sucursal Monix</p>
                    </li>
                  </ol>
                </div>

                <div className="bg-[#001A3D] rounded-xl p-6 text-white">
                  <p className="text-sm opacity-80 mb-2 font-['Inter']">Tu número de cuenta</p>
                  <p className="text-xl font-['Plus_Jakarta_Sans'] font-semibold">ES91 2100 0418 4502 0005 1332</p>
                </div>

                <div className="bg-[#26FFC1]/10 border border-[#26FFC1]/20 rounded-xl p-4">
                  <p className="text-sm text-[#001A3D] font-['Inter']">
                    <strong>Tiempo de acreditación:</strong> Los cheques pueden tardar de 3 a 5 días hábiles en acreditarse.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 space-y-3">
              <button
                onClick={() => setStep('amount')}
                className="w-full py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
              >
                Simular depósito
              </button>
              <button
                onClick={() => setStep('success')}
                className="w-full py-3 px-4 bg-transparent border border-border hover:bg-accent text-[#001A3D] rounded-xl transition-all font-['Inter'] font-medium"
              >
                Enviar instrucciones por correo
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-border">
        <h2 className="text-2xl text-[#001A3D] mb-6 font-['Plus_Jakarta_Sans'] font-semibold">
          Depositar dinero
        </h2>

        <div className="space-y-4 mb-6">
          <p className="text-muted-foreground font-['Inter']">
            Selecciona el método de depósito que prefieras:
          </p>

          <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            method === 'transfer'
              ? 'border-[#26FFC1] bg-[#26FFC1]/5'
              : 'border-border hover:bg-accent'
          }`}>
            <input
              type="radio"
              name="depositMethod"
              value="transfer"
              checked={method === 'transfer'}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-4 h-4 mt-1 accent-[#26FFC1]"
            />
            <div className="flex-1">
              <p className="text-[#001A3D] font-['Inter'] font-medium mb-1">Transferencia bancaria</p>
              <p className="text-sm text-muted-foreground font-['Inter']">Transfiere desde otro banco a tu cuenta Monix</p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            method === 'cash'
              ? 'border-[#26FFC1] bg-[#26FFC1]/5'
              : 'border-border hover:bg-accent'
          }`}>
            <input
              type="radio"
              name="depositMethod"
              value="cash"
              checked={method === 'cash'}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-4 h-4 mt-1 accent-[#26FFC1]"
            />
            <div className="flex-1">
              <p className="text-[#001A3D] font-['Inter'] font-medium mb-1">Efectivo en sucursal</p>
              <p className="text-sm text-muted-foreground font-['Inter']">Deposita efectivo en cualquier oficina Monix</p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            method === 'check'
              ? 'border-[#26FFC1] bg-[#26FFC1]/5'
              : 'border-border hover:bg-accent'
          }`}>
            <input
              type="radio"
              name="depositMethod"
              value="check"
              checked={method === 'check'}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-4 h-4 mt-1 accent-[#26FFC1]"
            />
            <div className="flex-1">
              <p className="text-[#001A3D] font-['Inter'] font-medium mb-1">Cheque</p>
              <p className="text-sm text-muted-foreground font-['Inter']">Deposita un cheque a nombre de Monix</p>
            </div>
          </label>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setStep('instructions')}
            className="w-full py-3 px-4 bg-[#26FFC1] hover:bg-[#1FE6AF] text-[#001A3D] rounded-xl transition-all shadow-sm hover:shadow-md font-['Inter'] font-medium"
          >
            Ver instrucciones
          </button>
          <button
            onClick={onBack}
            className="w-full py-3 px-4 bg-transparent border border-border hover:bg-accent text-[#001A3D] rounded-xl transition-all font-['Inter'] font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
