import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  LogOut,
  ShieldCheck,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  changeOwnPassword,
  claimAdminAccount,
  loginAppUser,
  registerAppUser,
} from '../services/appAuthApi';
import { AppUser, PublicConfig } from '../types/auth';

interface AuthModalProps {
  isOpen: boolean;
  canDismiss: boolean;
  isOnline: boolean;
  currentUser: AppUser | null;
  publicConfig: PublicConfig;
  onClose: () => void;
  onAuthenticated: (user: AppUser) => void;
  onLogout: () => void;
  onConfigChanged: () => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

type AuthMode = 'login' | 'register' | 'claim-admin';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  canDismiss,
  isOnline,
  currentUser,
  publicConfig,
  onClose,
  onAuthenticated,
  onLogout,
  onConfigChanged,
  onNotify,
}) => {
  const needsAdminClaim =
    !publicConfig.adminClaimed && !publicConfig.envPasscodeConfigured;

  const [mode, setMode] = useState<AuthMode>(
    needsAdminClaim ? 'claim-admin' : 'login'
  );
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setPassword('');
      setCurrentPassword('');
      setNewPassword('');
      if (needsAdminClaim) {
        setMode('claim-admin');
        setUsername('admin');
      } else {
        setMode('login');
      }
    }
  }, [isOpen, needsAdminClaim]);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setErrorMsg('ไม่สามารถตรวจสอบบัญชีผู้ใช้ขณะออฟไลน์ได้');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (mode === 'claim-admin') {
        const user = await claimAdminAccount({
          username: 'admin',
          password,
          displayName: displayName.trim() || 'ผู้ดูแลระบบ (Admin)',
        });
        onConfigChanged();
        onAuthenticated(user);
        onNotify('ตั้งค่าและเข้าสู่ระบบผู้ดูแลระบบ (admin) เรียบร้อยแล้ว', 'success');
        onClose();
      } else if (mode === 'register') {
        const user = await registerAppUser({
          username,
          password,
          displayName: displayName.trim() || username,
        });
        onAuthenticated(user);
        onNotify(`สมัครสมาชิกและเข้าสู่ระบบในชื่อ ${user.displayName} แล้ว`, 'success');
        onClose();
      } else {
        const user = await loginAppUser({ username, password });
        onAuthenticated(user);
        onNotify(`ยินดีต้อนรับ ${user.displayName}`, 'success');
        onClose();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      onNotify('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#181818] border border-white/10 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1DB954]/15 text-[#1ED760] flex items-center justify-center">
              {currentUser?.role === 'admin' || mode === 'claim-admin' ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <UserCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {currentUser
                  ? 'บัญชีผู้ใช้งาน'
                  : mode === 'claim-admin'
                  ? 'ตั้งค่าผู้ดูแลระบบครั้งแรก'
                  : mode === 'register'
                  ? 'สมัครสมาชิกใหม่'
                  : 'เข้าสู่ระบบ Spotiflow'}
              </h3>
              <p className="text-xs text-[#A7A7A7]">
                {currentUser
                  ? `${currentUser.username} · ${
                      currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งานทั่วไป'
                    }`
                  : 'จัดการสิทธิ์การใช้งานและหน้าผู้ดูแลระบบ'}
              </p>
            </div>
          </div>

          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-[#A7A7A7] hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {currentUser ? (
          <div className="space-y-5">
            <div className="rounded-xl bg-[#121212] border border-white/10 p-4 space-y-1">
              <p className="text-sm font-bold text-white">{currentUser.displayName}</p>
              <p className="text-xs text-[#A7A7A7]">
                ชื่อผู้ใช้: <span className="font-mono text-white">{currentUser.username}</span> · บทบาท:{' '}
                <span className={currentUser.role === 'admin' ? 'text-[#1ED760] font-semibold' : 'text-white'}>
                  {currentUser.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งาน (User)'}
                </span>
              </p>
            </div>

            {!(currentUser.username === 'admin' && publicConfig.envPasscodeConfigured) && (
              <form onSubmit={(e) => void handlePasswordChange(e)} className="space-y-3">
                <p className="text-xs font-semibold text-[#D4D4D4] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#1ED760]" />
                  <span>เปลี่ยนรหัสผ่านส่วนตัว</span>
                </p>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="รหัสผ่านเดิม"
                  className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#1DB954]"
                />
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="รหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)"
                  className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#1DB954]"
                />
                {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-white/10 hover:bg-white/20 py-2.5 text-xs font-semibold text-white transition min-h-[42px]"
                >
                  {submitting ? 'กำลังบันทึก...' : 'อัปเดตรหัสผ่าน'}
                </button>
              </form>
            )}

            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-semibold transition min-h-[42px]"
              >
                <LogOut className="w-4 h-4" />
                <span>ออกจากระบบ</span>
              </button>
              {canDismiss && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-full bg-[#1DB954] hover:bg-[#1ED760] text-black text-xs font-bold transition min-h-[42px]"
                >
                  ปิดหน้าต่าง
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Mode Switcher */}
            {!needsAdminClaim && (
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#121212] border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition ${
                    mode === 'login'
                      ? 'bg-[#282828] text-white'
                      : 'text-[#A7A7A7] hover:text-white'
                  }`}
                >
                  เข้าสู่ระบบ
                </button>
                <button
                  type="button"
                  disabled={!publicConfig.settings.allowSelfRegistration}
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition disabled:opacity-40 ${
                    mode === 'register'
                      ? 'bg-[#282828] text-white'
                      : 'text-[#A7A7A7] hover:text-white'
                  }`}
                >
                  สมัครสมาชิก
                </button>
              </div>
            )}

            {mode === 'claim-admin' && (
              <div className="rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/25 p-3.5 text-xs text-[#D4D4D4] leading-relaxed">
                ยังไม่มีรหัสผ่านผู้ดูแลระบบที่ตั้งไว้ กรุณากำหนดรหัสผ่านสำหรับบัญชี{' '}
                <strong className="text-white font-mono">admin</strong> เพื่อเปิดใช้งานหน้าจัดการระบบและผู้ใช้งาน
              </div>
            )}

            <form onSubmit={(e) => void handleAuthSubmit(e)} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#A7A7A7] mb-1">
                  ชื่อผู้ใช้ (Username)
                </label>
                <input
                  type="text"
                  required
                  readOnly={mode === 'claim-admin'}
                  value={mode === 'claim-admin' ? 'admin' : username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="เช่น admin หรือ somchai"
                  className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#1DB954] read-only:opacity-75"
                />
              </div>

              {(mode === 'register' || mode === 'claim-admin') && (
                <div>
                  <label className="block text-xs font-medium text-[#A7A7A7] mb-1">
                    ชื่อที่แสดง (Display Name)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={
                      mode === 'claim-admin'
                        ? 'ผู้ดูแลระบบ (Admin)'
                        : 'ชื่อเล่นหรือชื่อของคุณ'
                    }
                    className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#1DB954]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#A7A7A7] mb-1">
                  รหัสผ่าน
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full rounded-xl bg-[#121212] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#1DB954]"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#1DB954] hover:bg-[#1ED760] disabled:opacity-50 py-3 text-sm font-bold text-black transition min-h-[46px]"
              >
                {mode === 'register' && <UserPlus className="w-4 h-4" />}
                <span>
                  {submitting
                    ? 'กำลังดำเนินการ...'
                    : mode === 'claim-admin'
                    ? 'ตั้งรหัสผ่าน Admin และเข้าสู่ระบบ'
                    : mode === 'register'
                    ? 'สร้างบัญชีผู้ใช้'
                    : 'เข้าสู่ระบบ'}
                </span>
              </button>

              {needsAdminClaim && publicConfig.settings.allowSelfRegistration && (
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="w-full text-center text-xs text-[#A7A7A7] hover:text-white py-1"
                >
                  หรือสมัครสมาชิกทั่วไป
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
};
