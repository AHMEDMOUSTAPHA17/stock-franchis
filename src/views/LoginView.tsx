import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import { Store, ShieldCheck, Lock, User, ArrowLeft, KeyRound, AlertCircle } from 'lucide-react';

export function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState('founder');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data = await apiRequest<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            G.STOCK-Franchise
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            نظام تخطيط موارد المؤسسة المتكامل | AFLOU ERP v3.0.0
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-700/60 text-slate-200">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-sm">تسجيل الدخول إلى محطة العمل</h2>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                اسم المستخدم (Username)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  dir="ltr"
                  placeholder="e.g. founder"
                  className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                كلمة المرور (Password)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  dir="ltr"
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              <span>{isLoading ? 'جاري التحقق...' : 'دخول إلى النظام'}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Accounts Selection */}
          <div className="mt-6 pt-5 border-t border-slate-700/60">
            <p className="text-[11px] font-medium text-slate-400 mb-2.5">
              حسابات تجريبية سريعة حسب مصفوفة الصلاحيات:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('founder', 'admin123')}
                className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-700 text-right transition group cursor-pointer"
              >
                <div className="text-[11px] font-bold text-amber-400 group-hover:underline">المؤسس</div>
                <div className="text-[10px] text-slate-400 font-mono">founder</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'admin123')}
                className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-700 text-right transition group cursor-pointer"
              >
                <div className="text-[11px] font-bold text-indigo-400 group-hover:underline">المدير</div>
                <div className="text-[10px] text-slate-400 font-mono">admin</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('cashier', 'user123')}
                className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-700 text-right transition group cursor-pointer"
              >
                <div className="text-[11px] font-bold text-emerald-400 group-hover:underline">الكاشير</div>
                <div className="text-[10px] text-slate-400 font-mono">cashier</div>
              </button>
            </div>
          </div>
        </div>

        {/* Invariant Note */}
        <div className="mt-4 text-center text-xs text-slate-500">
          <span>سلطة الخادم المطلقة • تخزين SQLite محلي • بدون تبعيات سحابية خارجية</span>
        </div>
      </div>
    </div>
  );
}
