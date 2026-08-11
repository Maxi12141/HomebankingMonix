import { useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { DashboardPage } from './components/DashboardPage';
import { TransferPage } from './components/TransferPage';
import { HistoryPage } from './components/HistoryPage';
import { ProfilePage } from './components/ProfilePage';
import { WithdrawPage } from './components/WithdrawPage';
import { DepositPage } from './components/DepositPage';

type Page = 'login' | 'dashboard' | 'transfer' | 'history' | 'profile' | 'withdraw' | 'deposit';

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

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([
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
    }
  ]);
  const [balance, setBalance] = useState(12485.50);

  const handleLogout = () => {
    setCurrentPage('login');
    setUserData(null);
  };

  const handleLogin = (username: string, password: string) => {
    // Aquí normalmente verificarías contra la base de datos
    // Por ahora, si hay datos guardados los usamos, sino creamos usuario temporal
    if (userData && userData.username === username) {
      setCurrentPage('dashboard');
    } else {
      // Usuario temporal para login sin registro previo
      setUserData({
        username,
        firstName: '',
        lastName: '',
        dni: '',
        email: '',
        phone: '',
        birthDate: '',
        password
      });
      setCurrentPage('dashboard');
    }
  };

  const handleRegister = (newUserData: UserData) => {
    setUserData(newUserData);
    setCurrentPage('dashboard');
  };

  const handleUpdateProfile = (updatedData: Partial<UserData>) => {
    if (userData) {
      setUserData({ ...userData, ...updatedData });
    }
  };

  const addTransaction = (newTransaction: Omit<Transaction, 'id' | 'balance'>) => {
    const newBalance = balance + newTransaction.amount;
    const transaction: Transaction = {
      ...newTransaction,
      id: transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1,
      balance: newBalance
    };
    setTransactions([transaction, ...transactions]);
    setBalance(newBalance);
  };

  const navigateTo = (page: Page) => {
    setCurrentPage(page);
  };

  return (
    <div className="size-full">
      {currentPage === 'login' && (
        <LoginPage onLogin={handleLogin} onRegister={handleRegister} />
      )}
      {currentPage === 'dashboard' && userData && (
        <DashboardPage
          username={userData.username}
          profilePhoto={userData.profilePhoto}
          balance={balance}
          transactions={transactions}
          onLogout={handleLogout}
          onNavigate={navigateTo}
        />
      )}
      {currentPage === 'transfer' && (
        <TransferPage
          balance={balance}
          onBack={() => navigateTo('dashboard')}
          onTransferComplete={addTransaction}
        />
      )}
      {currentPage === 'withdraw' && (
        <WithdrawPage
          balance={balance}
          onBack={() => navigateTo('dashboard')}
          onWithdrawComplete={addTransaction}
        />
      )}
      {currentPage === 'deposit' && (
        <DepositPage
          onBack={() => navigateTo('dashboard')}
          onDepositComplete={addTransaction}
        />
      )}
      {currentPage === 'history' && (
        <HistoryPage
          transactions={transactions}
          onBack={() => navigateTo('dashboard')}
        />
      )}
      {currentPage === 'profile' && userData && (
        <ProfilePage
          userData={userData}
          onBack={() => navigateTo('dashboard')}
          onUpdateProfile={handleUpdateProfile}
        />
      )}
    </div>
  );
}