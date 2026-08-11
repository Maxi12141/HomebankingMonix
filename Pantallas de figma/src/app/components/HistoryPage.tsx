import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Filter, Search } from 'lucide-react';

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

interface HistoryPageProps {
  transactions: Transaction[];
  onBack: () => void;
}

export function HistoryPage({ transactions, onBack }: HistoryPageProps) {
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const allTransactions: Transaction[] = transactions.length > 0 ? transactions : [
    {
      id: 1,
      type: 'income',
      description: 'Transferencia recibida',
      from: 'Juan Pérez',
      amount: 1250.00,
      date: '2026-04-20',
      time: '10:30',
      balance: 12485.50
    },
    {
      id: 2,
      type: 'expense',
      description: 'Pago de servicio',
      from: 'Netflix',
      amount: -15.99,
      date: '2026-04-19',
      time: '14:22',
      balance: 11235.50
    },
    {
      id: 3,
      type: 'expense',
      description: 'Compra',
      from: 'Amazon',
      amount: -89.50,
      date: '2026-04-19',
      time: '09:15',
      balance: 11251.49
    },
    {
      id: 4,
      type: 'income',
      description: 'Salario',
      from: 'Empresa XYZ',
      amount: 3500.00,
      date: '2026-04-18',
      time: '08:00',
      balance: 11340.99
    },
    {
      id: 5,
      type: 'expense',
      description: 'Supermercado',
      from: 'Mercadona',
      amount: -125.30,
      date: '2026-04-17',
      time: '18:45',
      balance: 7840.99
    },
    {
      id: 6,
      type: 'transfer',
      description: 'Transferencia enviada',
      from: 'María García',
      amount: -500.00,
      date: '2026-04-16',
      time: '16:20',
      balance: 7966.29
    },
    {
      id: 7,
      type: 'income',
      description: 'Depósito',
      from: 'Efectivo',
      amount: 200.00,
      date: '2026-04-15',
      time: '11:30',
      balance: 8466.29
    },
    {
      id: 8,
      type: 'expense',
      description: 'Pago de servicio',
      from: 'Spotify',
      amount: -9.99,
      date: '2026-04-14',
      time: '09:00',
      balance: 8266.29
    }
  ];

  const filteredTransactions = allTransactions.filter(transaction => {
    const matchesType = filterType === 'all' || transaction.type === filterType;
    const matchesSearch = searchTerm === '' ||
      transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.from.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

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
          <h1 className="text-3xl text-[#001A3D] font-['Plus_Jakarta_Sans'] font-semibold">
            Historial de movimientos
          </h1>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por descripción o destinatario..."
                className="w-full px-4 py-3 pl-12 rounded-xl bg-input-background border border-transparent focus:border-[#26FFC1] focus:outline-none focus:ring-2 focus:ring-[#26FFC1]/20 transition-all font-['Inter']"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-3 rounded-xl transition-all font-['Inter'] font-medium ${
                  filterType === 'all'
                    ? 'bg-[#001A3D] text-white'
                    : 'bg-input-background text-[#001A3D] hover:bg-accent'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType('income')}
                className={`px-4 py-3 rounded-xl transition-all font-['Inter'] font-medium ${
                  filterType === 'income'
                    ? 'bg-[#26FFC1] text-[#001A3D]'
                    : 'bg-input-background text-[#001A3D] hover:bg-accent'
                }`}
              >
                Ingresos
              </button>
              <button
                onClick={() => setFilterType('expense')}
                className={`px-4 py-3 rounded-xl transition-all font-['Inter'] font-medium ${
                  filterType === 'expense'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-input-background text-[#001A3D] hover:bg-accent'
                }`}
              >
                Gastos
              </button>
              <button
                onClick={() => setFilterType('transfer')}
                className={`px-4 py-3 rounded-xl transition-all font-['Inter'] font-medium ${
                  filterType === 'transfer'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-input-background text-[#001A3D] hover:bg-accent'
                }`}
              >
                Transferencias
              </button>
            </div>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-border">
            <Filter size={48} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl text-[#001A3D] mb-2 font-['Plus_Jakarta_Sans'] font-medium">
              No se encontraron movimientos
            </h3>
            <p className="text-muted-foreground font-['Inter']">
              Intenta ajustar los filtros de búsqueda
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F0F2F5]">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm text-muted-foreground font-['Inter'] font-medium">
                      Fecha
                    </th>
                    <th className="px-6 py-4 text-left text-sm text-muted-foreground font-['Inter'] font-medium">
                      Descripción
                    </th>
                    <th className="px-6 py-4 text-right text-sm text-muted-foreground font-['Inter'] font-medium">
                      Monto
                    </th>
                    <th className="px-6 py-4 text-right text-sm text-muted-foreground font-['Inter'] font-medium">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-accent transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              transaction.type === 'income'
                                ? 'bg-[#26FFC1]/20'
                                : transaction.type === 'transfer'
                                ? 'bg-blue-100'
                                : 'bg-red-100'
                            }`}
                          >
                            {transaction.type === 'income' ? (
                              <ArrowDownLeft size={18} className="text-[#26FFC1]" strokeWidth={2.5} />
                            ) : (
                              <ArrowUpRight
                                size={18}
                                className={transaction.type === 'transfer' ? 'text-blue-600' : 'text-red-600'}
                                strokeWidth={2.5}
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-[#001A3D] font-['Inter'] font-medium">
                              {transaction.date}
                            </p>
                            <p className="text-xs text-muted-foreground font-['Inter']">
                              {transaction.time}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[#001A3D] font-['Inter'] font-medium">
                          {transaction.description}
                        </p>
                        <p className="text-sm text-muted-foreground font-['Inter']">
                          {transaction.from}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p
                          className={`font-['Plus_Jakarta_Sans'] font-semibold ${
                            transaction.type === 'income'
                              ? 'text-[#26FFC1]'
                              : 'text-[#001A3D]'
                          }`}
                        >
                          {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-[#001A3D] font-['Inter'] font-medium">
                          ${transaction.balance.toFixed(2)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground font-['Inter']">
            Mostrando {filteredTransactions.length} de {allTransactions.length} movimientos
          </p>
        </div>
      </div>
    </div>
  );
}
