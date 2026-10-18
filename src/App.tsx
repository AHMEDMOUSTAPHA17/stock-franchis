import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar, TabId } from './components/Sidebar.tsx';
import { LoginView } from './views/LoginView.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { PosView } from './views/PosView.tsx';
import { InventoryView } from './views/InventoryView.tsx';
import { ImportView } from './views/ImportView.tsx';
import { PurchasesView } from './views/PurchasesView.tsx';
import { CashView } from './views/CashView.tsx';
import { SnapshotsView } from './views/SnapshotsView.tsx';
import { UsersView } from './views/UsersView.tsx';
import { AuditView } from './views/AuditView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { RefreshCw } from 'lucide-react';

function MainApp() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          <span className="text-xs">جاري بدء تشغيل محطة العمل المحلية...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === 'pos' && <PosView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'import' && <ImportView />}
          {activeTab === 'purchases' && <PurchasesView />}
          {activeTab === 'cash' && <CashView />}
          {activeTab === 'snapshots' && <SnapshotsView />}
          {activeTab === 'users' && <UsersView />}
          {activeTab === 'audit' && <AuditView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
