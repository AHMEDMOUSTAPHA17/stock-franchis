import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import { User, UserRole } from '../types/index.ts';
import {
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
  ShoppingBag,
  Trash2,
  KeyRound,
  X,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export function UsersView() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');

  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFounder = currentUser?.role === 'founder';

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/users');
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
        }),
      });

      setShowAddModal(false);
      setNewUsername('');
      setNewPassword('');
      fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'فشل إنشاء المستخدم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      await apiRequest(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ password: resetPasswordVal }),
      });

      setShowPasswordModal(false);
      setResetPasswordVal('');
      fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'فشل تغيير كلمة المرور');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (userToDelete.role === 'founder') {
      alert('حظر أمني: يُمنع منعاً باتاً حذف حساب المؤسس!');
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف المستخدم (${userToDelete.username}) نهائياً؟`)) {
      return;
    }

    try {
      await apiRequest(`/api/users/${userToDelete.id}`, { method: 'DELETE' });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'فشل حذف المستخدم');
    }
  };

  const handleToggleActive = async (targetUser: User) => {
    if (targetUser.role === 'founder') {
      alert('لا يمكن تعطيل حساب المؤسس');
      return;
    }

    try {
      await apiRequest(`/api/users/${targetUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: targetUser.is_active === 1 ? 0 : 1 }),
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'فشل تعديل حالة الحساب');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>إدارة مستخدمي محطة العمل (RBAC Management)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            صلاحيات الأدوار: المؤسس (Founder) • المدير (Admin) • الكاشير (User)
          </p>
        </div>

        <button
          onClick={() => {
            setNewUsername('');
            setNewPassword('');
            setNewRole('user');
            setModalError(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>إنشاء مستخدم جديد</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-bold">اسم المستخدم</th>
                <th className="py-3 px-4 font-bold">الرتبة والدور</th>
                <th className="py-3 px-4 font-bold text-center">حالة الحساب</th>
                <th className="py-3 px-4 font-bold text-center">آخر تسجيل دخول</th>
                <th className="py-3 px-4 font-bold text-center">تاريخ الإنشاء</th>
                <th className="py-3 px-4 font-bold text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => {
                const isItemFounder = u.role === 'founder';
                return (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {u.username}
                      {u.id === currentUser?.id && (
                        <span className="mr-1.5 text-[10px] text-emerald-600 font-normal">(حسابك الحالي)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          u.role === 'founder'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                            : u.role === 'admin'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400'
                        }`}
                      >
                        {u.role === 'founder' ? 'المؤسس (Founder)' : u.role === 'admin' ? 'المدير (Admin)' : 'كاشير (User)'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        disabled={isItemFounder}
                        onClick={() => handleToggleActive(u)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition ${
                          u.is_active === 1
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-400'
                        } ${isItemFounder ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:opacity-80'}`}
                      >
                        {u.is_active === 1 ? 'مفعل نشط' : 'معطل'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500 font-mono-numbers">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('ar-DZ') : 'لم يدخل بعد'}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono-numbers">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('ar-DZ') : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setResetPasswordVal('');
                            setModalError(null);
                            setShowPasswordModal(true);
                          }}
                          title="إعادة تعيين كلمة المرور"
                          className="p-1 rounded text-slate-400 hover:text-amber-600 transition"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {!isItemFounder && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            title="حذف المستخدم"
                            className="p-1 rounded text-slate-400 hover:text-red-500 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>إنشاء حساب مستخدم جديد</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 mb-3 rounded-lg bg-red-50 text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المستخدم (Username) *
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  dir="ltr"
                  placeholder="e.g. cashier2"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  كلمة المرور الأولية *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  dir="ltr"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الرتبة والصلاحية (Role) *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                >
                  <option value="user">كاشير تشغيلي (User - حجب أسعار الشراء)</option>
                  {isFounder && <option value="admin">مدير نظام (Admin - صلاحيات إدارية كاملة)</option>}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 text-xs text-slate-500"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>إعادة تعيين كلمة مرور: {selectedUser.username}</span>
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 mb-3 rounded-lg bg-red-50 text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  كلمة المرور الجديدة *
                </label>
                <input
                  type="password"
                  required
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  dir="ltr"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3 py-2 text-xs text-slate-500"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold"
                >
                  {isSubmitting ? 'جاري التعيين...' : 'تأكيد كلمة المرور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
