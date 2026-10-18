import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  FileSpreadsheet,
  Truck,
  Coins,
  HardDriveDownload,
  Users,
  ShieldAlert,
  Sliders,
} from 'lucide-react';

export type TabId =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'import'
  | 'purchases'
  | 'cash'
  | 'snapshots'
  | 'users'
  | 'audit'
  | 'settings';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { user, hasRole } = useAuth();

  const isFounder = user?.role === 'founder';
  const isAdminOrFounder = hasRole(['founder', 'admin']);

  const navItems = [
    {
      id: 'dashboard' as TabId,
      label: 'لوحة القيادة',
      icon: LayoutDashboard,
      visible: true,
    },
    {
      id: 'pos' as TabId,
      label: 'نقطة البيع (POS)',
      icon: ShoppingCart,
      badge: 'بيع مباشر',
      visible: true,
    },
    {
      id: 'inventory' as TabId,
      label: 'المخزون والأصناف',
      icon: Boxes,
      visible: true,
    },
    {
      id: 'import' as TabId,
      label: 'استيراد آمن (3 مراحل)',
      icon: FileSpreadsheet,
      visible: isAdminOrFounder,
    },
    {
      id: 'purchases' as TabId,
      label: 'المشتريات والتوريد',
      icon: Truck,
      visible: isAdminOrFounder,
    },
    {
      id: 'cash' as TabId,
      label: 'الخزينة والسيولة',
      icon: Coins,
      visible: true,
    },
    {
      id: 'snapshots' as TabId,
      label: 'النسخ وحفظ الحالة',
      icon: HardDriveDownload,
      badge: 'محلي',
      visible: isAdminOrFounder,
    },
    {
      id: 'users' as TabId,
      label: 'إدارة المستخدمين',
      icon: Users,
      visible: isAdminOrFounder,
    },
    {
      id: 'audit' as TabId,
      label: 'سجل التدقيق الجنائي',
      icon: ShieldAlert,
      badge: 'مؤسس',
      visible: isFounder,
    },
    {
      id: 'settings' as TabId,
      label: 'الإعدادات ومحرك التسعير',
      icon: Sliders,
      visible: isAdminOrFounder,
    },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 transition-colors">
      <nav className="p-3 space-y-1 overflow-y-auto flex-1">
        {navItems
          .filter((item) => item.visible)
          .map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                      isActive
                        ? 'bg-emerald-700/60 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
      </nav>

      {/* Database status footer */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-400 dark:text-slate-500">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>SQLite WAL نشط</span>
          </span>
          <span className="font-mono-numbers">DZD</span>
        </div>
      </div>
    </aside>
  );
}
