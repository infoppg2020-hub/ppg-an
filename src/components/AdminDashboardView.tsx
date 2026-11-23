import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  adminCreateUser,
  adminDeleteUser,
  adminUpdateSettings,
  adminUpdateUser,
  fetchAdminOverview,
} from '../services/appAuthApi';
import {
  AdminOverviewData,
  AppUser,
  SystemSettings,
  UserRole,
} from '../types/auth';
import { formatBytes } from '../utils/formatters';
import { ConfirmDialog } from './Modals';

interface AdminDashboardViewProps {
  currentUser: AppUser;
  storageStats: { cachedBytes: number; cachedCount: number };
  onSettingsUpdated: (settings: SystemSettings) => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

type AdminSubTab = 'users' | 'settings' | 'logs';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUser,
  storageStats,
  onSettingsUpdated,
  onNotify,
}) => {
  const [subTab, setSubTab] = useState<AdminSubTab>('users');
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');

  // Create user modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [savingUser, setSavingUser] = useState(false);

  // Reset password modal state
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<SystemSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const overview = await fetchAdminOverview();
      setData(overview);
      setSettingsForm(overview.settings);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลผู้ดูแลระบบได้',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = searchTerm.trim().toLowerCase();
    return data.users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q)
      );
    });
  }, [data, roleFilter, searchTerm]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      await adminCreateUser({
        username: newUsername,
        displayName: newDisplayName.trim() || newUsername,
        password: newPassword,
        role: newRole,
      });
      setCreateOpen(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setNewRole('user');
      onNotify('เพิ่มบัญชีผู้ใช้ใหม่เรียบร้อยแล้ว', 'success');
      await loadOverview();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถสร้างบัญชีผู้ใช้ได้',
        'error'
      );
    } finally {
      setSavingUser(false);
    }
  };

  const handleToggleStatus = async (user: AppUser) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await adminUpdateUser(user.id, { status: nextStatus });
      onNotify(
        nextStatus === 'suspended'
          ? `ระงับบัญชี ${user.username} แล้ว`
          : `เปิดใช้งานบัญชี ${user.username} แล้ว`,
        'info'
      );
      await loadOverview();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'อัปเดตสถานะไม่สำเร็จ', 'error');
    }
  };

  const handleToggleRole = async (user: AppUser) => {
    const nextRole: UserRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await adminUpdateUser(user.id, { role: nextRole });
      onNotify(`เปลี่ยนสิทธิ์ ${user.username} เป็น ${nextRole} แล้ว`, 'success');
      await loadOverview();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'เปลี่ยนสิทธิ์ไม่สำเร็จ', 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setSavingUser(true);
    try {
      await adminUpdateUser(resetTarget.id, { password: resetPasswordValue });
      onNotify(`ตั้งรหัสผ่านใหม่ให้ ${resetTarget.username} แล้ว`, 'success');
      setResetTarget(null);
      setResetPasswordValue('');
      await loadOverview();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'รีเซ็ตรหัสผ่านไม่สำเร็จ', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminDeleteUser(deleteTarget.id);
      onNotify(`ลบบัญชี ${deleteTarget.username} เรียบร้อยแล้ว`, 'info');
      setDeleteTarget(null);
      await loadOverview();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'ลบบัญชีไม่สำเร็จ', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;
    setSavingSettings(true);
    try {
      const saved = await adminUpdateSettings(settingsForm);
      setSettingsForm(saved);
      onSettingsUpdated(saved);
      onNotify('บันทึกการตั้งค่าระบบเรียบร้อยแล้ว', 'success');
      await loadOverview();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'บันทึกการตั้งค่าไม่สำเร็จ', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#A7A7A7]">
        <Loader2 className="w-7 h-7 animate-spin text-[#1ED760]" />
        <p className="text-sm">กำลังโหลดข้อมูลศูนย์จัดการระบบ...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            ศูนย์จัดการระบบและผู้ใช้งาน
          </h1>
          <p className="text-xs text-[#A7A7A7] mt-1">
            ผู้ดูแลระบบ: {currentUser.displayName} ({currentUser.username}) · จัดการบัญชี สิทธิ์ และการตั้งค่าออฟไลน์
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#181818] hover:bg-[#282828] border border-white/10 text-xs font-semibold text-white transition min-h-[42px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1DB954] hover:bg-[#1ED760] text-xs font-bold text-black transition min-h-[42px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>เพิ่มผู้ใช้ใหม่</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-[#181818] border border-white/5 p-4 space-y-1">
            <p className="text-xs text-[#A7A7A7]">ผู้ใช้งานทั้งหมด</p>
            <p className="text-2xl font-bold text-white font-mono tabular-nums">
              {data.stats.totalUsers}
            </p>
            <p className="text-[11px] text-[#A7A7A7] font-mono tabular-nums">
              Admin {data.stats.adminCount} บัญชี
            </p>
          </div>

          <div className="rounded-2xl bg-[#181818] border border-white/5 p-4 space-y-1">
            <p className="text-xs text-[#A7A7A7]">บัญชีใช้งานปกติ</p>
            <p className="text-2xl font-bold text-[#1ED760] font-mono tabular-nums">
              {data.stats.activeUsers}
            </p>
            <p className="text-[11px] text-[#A7A7A7]">สถานะพร้อมเข้าสู่ระบบ</p>
          </div>

          <div className="rounded-2xl bg-[#181818] border border-white/5 p-4 space-y-1">
            <p className="text-xs text-[#A7A7A7]">บัญชีที่ถูกระงับ</p>
            <p className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
              {data.stats.suspendedUsers}
            </p>
            <p className="text-[11px] text-[#A7A7A7]">บล็อกการเข้าสู่ระบบ</p>
          </div>

          <div className="rounded-2xl bg-[#181818] border border-white/5 p-4 space-y-1">
            <p className="text-xs text-[#A7A7A7]">แคชออฟไลน์บนเครื่องนี้</p>
            <p className="text-2xl font-bold text-white font-mono tabular-nums">
              {storageStats.cachedCount}
            </p>
            <p className="text-[11px] text-[#A7A7A7] font-mono tabular-nums">
              {formatBytes(storageStats.cachedBytes)}
            </p>
          </div>
        </div>
      )}

      {/* Sub-navigation Segmented Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#181818] border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setSubTab('users')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            subTab === 'users'
              ? 'bg-[#282828] text-white'
              : 'text-[#A7A7A7] hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>จัดการผู้ใช้</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('settings')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            subTab === 'settings'
              ? 'bg-[#282828] text-white'
              : 'text-[#A7A7A7] hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>ตั้งค่าระบบ</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('logs')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            subTab === 'logs'
              ? 'bg-[#282828] text-white'
              : 'text-[#A7A7A7] hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>ประวัติกิจกรรม</span>
        </button>
      </div>

      {/* Tab 1: Users Management */}
      {subTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[#A7A7A7] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อผู้ใช้ หรือชื่อที่แสดง..."
                className="w-full rounded-full bg-[#181818] border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#1DB954]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#181818] border border-white/10 self-start">
              {(['all', 'admin', 'user'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    roleFilter === r
                      ? 'bg-[#282828] text-white'
                      : 'text-[#A7A7A7] hover:text-white'
                  }`}
                >
                  {r === 'all' ? 'ทั้งหมด' : r === 'admin' ? 'Admin' : 'ผู้ใช้ทั่วไป'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#181818] border border-white/5 divide-y divide-white/5 overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#A7A7A7]">
                ไม่พบบัญชีผู้ใช้ที่ตรงกับเงื่อนไข
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelf = u.id === currentUser.id;
                const isPrimaryAdmin = u.username === 'admin';
                return (
                  <div
                    key={u.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.03] transition"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">{u.displayName}</p>
                        <span className="text-xs font-mono text-[#A7A7A7]">
                          @{u.username}
                        </span>
                        {isSelf && (
                          <span className="text-xs text-[#1ED760] font-medium">
                            · กำลังใช้งาน
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#A7A7A7] flex-wrap">
                        <span
                          className={
                            u.role === 'admin'
                              ? 'text-[#1ED760] font-semibold'
                              : 'text-[#D4D4D4]'
                          }
                        >
                          {u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            u.status === 'active' ? 'text-emerald-400' : 'text-red-400'
                          }
                        >
                          {u.status === 'active' ? 'ใช้งานได้' : 'ถูกระงับ'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          เข้าล่าสุด:{' '}
                          {u.lastLoginAt
                            ? new Date(u.lastLoginAt).toLocaleString('th-TH', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'ยังไม่เคยเข้า'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isSelf || isPrimaryAdmin}
                        onClick={() => void handleToggleRole(u)}
                        title="สลับบทบาท Admin / User"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-35 text-xs font-medium text-white transition min-h-[38px]"
                      >
                        <Shield className="w-3.5 h-3.5 text-[#1ED760]" />
                        <span>{u.role === 'admin' ? 'ลดเป็น User' : 'ตั้งเป็น Admin'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSelf || isPrimaryAdmin}
                        onClick={() => void handleToggleStatus(u)}
                        title={u.status === 'active' ? 'ระงับการใช้งาน' : 'เปิดใช้งาน'}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-35 text-xs font-medium text-white transition min-h-[38px]"
                      >
                        {u.status === 'active' ? (
                          <>
                            <Ban className="w-3.5 h-3.5 text-amber-400" />
                            <span>ระงับ</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#1ED760]" />
                            <span>เปิดใช้</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setResetTarget(u);
                          setResetPasswordValue('');
                        }}
                        title="รีเซ็ตรหัสผ่าน"
                        className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#A7A7A7] hover:text-white transition"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={isSelf || isPrimaryAdmin}
                        onClick={() => setDeleteTarget(u)}
                        title="ลบบัญชีผู้ใช้"
                        className="w-9 h-9 rounded-lg bg-white/5 hover:bg-red-500/15 disabled:opacity-35 flex items-center justify-center text-[#A7A7A7] hover:text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: System Settings */}
      {subTab === 'settings' && settingsForm && (
        <form
          onSubmit={(e) => void handleSaveSettings(e)}
          className="rounded-2xl bg-[#181818] border border-white/5 p-6 space-y-5 max-w-2xl"
        >
          <div className="space-y-4">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-white">
                  เปิดให้ผู้ใช้งานสมัครสมาชิกใหม่ด้วยตนเอง
                </p>
                <p className="text-xs text-[#A7A7A7] mt-0.5">
                  หากปิด ผู้ดูแลระบบจะสามารถสร้างบัญชีผู้ใช้ใหม่ได้จากหน้านี้เท่านั้น
                </p>
              </div>
              <input
                type="checkbox"
                checked={settingsForm.allowSelfRegistration}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    allowSelfRegistration: e.target.checked,
                  })
                }
                className="w-5 h-5 accent-[#1DB954] mt-0.5 shrink-0"
              />
            </label>

            <div className="border-t border-white/5 pt-4">
              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-white">
                    บังคับเข้าสู่ระบบก่อนเปิดใช้งานเครื่องเล่นเพลง (เมื่อออนไลน์)
                  </p>
                  <p className="text-xs text-[#A7A7A7] mt-0.5">
                    โหมดออฟไลน์ยังคงฟังเพลงที่บันทึกไว้ในเครื่องได้ตามปกติ
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.requireAuthForPlayback}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      requireAuthForPlayback: e.target.checked,
                    })
                  }
                  className="w-5 h-5 accent-[#1DB954] mt-0.5 shrink-0"
                />
              </label>
            </div>

            <div className="border-t border-white/5 pt-4">
              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-white">
                    บันทึกเพลงจาก Google Drive ลงออฟไลน์อัตโนมัติเมื่อกดเล่น
                  </p>
                  <p className="text-xs text-[#A7A7A7] mt-0.5">
                    ช่วยให้เปิดฟังซ้ำและเล่นต่อเนื่องตอนหน้าจอดับได้ทันทีโดยไม่ต้องโหลดใหม่
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.defaultOfflineAutoCache}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      defaultOfflineAutoCache: e.target.checked,
                    })
                  }
                  className="w-5 h-5 accent-[#1DB954] mt-0.5 shrink-0"
                />
              </label>
            </div>

            <div className="border-t border-white/5 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A7A7A7] mb-1.5">
                  โควต้าพื้นที่ออฟไลน์แนะนำ (MB)
                </label>
                <input
                  type="number"
                  min={128}
                  max={32768}
                  value={settingsForm.maxOfflineQuotaMb}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      maxOfflineQuotaMb: Number(e.target.value) || 2048,
                    })
                  }
                  className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm font-mono tabular-nums text-white focus:outline-none focus:border-[#1DB954]"
                />
              </div>
            </div>

            <div className="border-t border-white/5 pt-4">
              <label className="block text-xs font-medium text-[#A7A7A7] mb-1.5">
                ประกาศจากผู้ดูแลระบบ (แสดงที่หน้าหลัก)
              </label>
              <input
                type="text"
                maxLength={240}
                value={settingsForm.announcementBanner}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    announcementBanner: e.target.value,
                  })
                }
                placeholder="เช่น อัปเดตคลังเพลงใหม่ในโฟลเดอร์ Chill Mix แล้ว"
                className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#1DB954]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] hover:bg-[#1ED760] disabled:opacity-50 px-6 py-2.5 text-sm font-bold text-black transition min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>{savingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าระบบ'}</span>
          </button>
        </form>
      )}

      {/* Tab 3: Audit Logs */}
      {subTab === 'logs' && data && (
        <div className="rounded-2xl bg-[#181818] border border-white/5 divide-y divide-white/5 overflow-hidden">
          {data.auditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#A7A7A7]">
              ยังไม่มีประวัติกิจกรรมในระบบ
            </div>
          ) : (
            data.auditLogs.map((log) => (
              <div
                key={log.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono font-semibold text-[#1ED760] shrink-0">
                    {log.action}
                  </span>
                  <span className="text-white truncate">{log.detail}</span>
                </div>
                <div className="flex items-center gap-2 text-[#A7A7A7] shrink-0 font-mono tabular-nums">
                  <span>@{log.actor}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {new Date(log.timestamp).toLocaleString('th-TH', {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create User Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void handleCreateUser(e)}
            className="w-full max-w-md rounded-2xl bg-[#1E1E1E] border border-white/10 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">เพิ่มบัญชีผู้ใช้ใหม่</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-[#A7A7A7]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#A7A7A7] mb-1">
                  ชื่อผู้ใช้ (a-z, 0-9, . _ -)
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="เช่น member01"
                  className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#A7A7A7] mb-1">ชื่อที่แสดง</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="เช่น คุณสมชาย"
                  className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#A7A7A7] mb-1">
                  รหัสผ่านเริ่มต้น
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="อย่างน้อย 4 ตัวอักษร"
                  className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#A7A7A7] mb-1">บทบาท</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954]"
                >
                  <option value="user">ผู้ใช้งานทั่วไป (User)</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2.5 rounded-full text-xs font-semibold text-[#D4D4D4] hover:bg-white/10"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={savingUser}
                className="px-5 py-2.5 rounded-full bg-[#1DB954] hover:bg-[#1ED760] text-xs font-bold text-black"
              >
                {savingUser ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void handleResetPassword(e)}
            className="w-full max-w-sm rounded-2xl bg-[#1E1E1E] border border-white/10 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                ตั้งรหัสผ่านใหม่: @{resetTarget.username}
              </h3>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-[#A7A7A7]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="password"
              required
              minLength={4}
              autoFocus
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              placeholder="กรอกรหัสผ่านใหม่ (4+ ตัวอักษร)"
              className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-[#D4D4D4] hover:bg-white/10"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={savingUser}
                className="px-5 py-2 rounded-full bg-[#1DB954] text-xs font-bold text-black"
              >
                บันทึกรหัสผ่าน
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="ลบบัญชีผู้ใช้นี้?"
        message={
          deleteTarget
            ? `ยืนยันการลบบัญชี "${deleteTarget.displayName}" (@${deleteTarget.username}) ออกจากระบบอย่างถาวร?`
            : ''
        }
        confirmLabel="ลบบัญชี"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
};
