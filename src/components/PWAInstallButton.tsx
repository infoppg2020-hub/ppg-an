import React, { useState } from 'react';
import {
  BatteryCharging,
  Check,
  Copy,
  Download,
  Share,
  Smartphone,
  Terminal,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install } =
    usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'url' | 'twa' | null>(null);

  if (isInstalled) {
    return null;
  }

  const appOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://spotiflow.app';
  const twaCommand = `npx @bubblewrap/cli init --manifest=${appOrigin}/manifest.webmanifest`;

  const handleCopy = async (text: string, key: 'url' | 'twa') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  // Native one-tap Chrome Android / Desktop WebAPK install prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title={isAndroid ? 'ติดตั้งเป็นแอป Android (WebAPK)' : 'ติดตั้งแอปลงอุปกรณ์'}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#1DB954]/15 hover:bg-[#1DB954]/25 border border-[#1DB954]/40 px-3 py-2 text-xs font-semibold text-[#1ED760] transition whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">
          {isAndroid ? 'ติดตั้งแอป Android' : 'ติดตั้งแอป'}
        </span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuideModal(true)}
        title={isIOS ? 'ติดตั้งแอปบน iPhone / iPad' : 'ติดตั้งเป็นแอป Android'}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-white transition whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Smartphone className="w-4 h-4 text-[#1ED760] shrink-0" />
        <span className="hidden sm:inline">
          {isIOS ? 'ติดตั้งบน iOS' : 'แอป Android'}
        </span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#1E1E1E] border border-white/10 p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1DB954]/15 text-[#1ED760] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {isIOS
                      ? 'ติดตั้ง Spotiflow บน iPhone / iPad'
                      : 'ใช้งาน Spotiflow เป็นแอป Android'}
                  </h3>
                  <p className="text-xs text-[#A7A7A7]">
                    {isIOS
                      ? 'เพิ่มลงหน้าจอโฮมเพื่อฟังออฟไลน์และปิดหน้าจอได้'
                      : 'ติดตั้งเป็นแอป Android เต็มจอ พร้อมไอคอนบนหน้าโฮมและควบคุมเพลงจากหน้าจอล็อก'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-[#A7A7A7] hover:text-white shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-3 text-sm text-[#D4D4D4] leading-relaxed bg-black/30 rounded-xl p-4 border border-white/5">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-[#1ED760] font-semibold">1.</span>
                  <span>
                    แตะปุ่ม{' '}
                    <strong className="text-white inline-flex items-center gap-1">
                      <Share className="w-3.5 h-3.5" /> แชร์ (Share)
                    </strong>{' '}
                    ที่แถบด้านล่างของ Safari
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-[#1ED760] font-semibold">2.</span>
                  <span>
                    เลื่อนลงแล้วเลือก{' '}
                    <strong className="text-white">เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)</strong>{' '}
                    เพื่อให้ฟังเพลงแบบออฟไลน์และปิดหน้าจอได้ต่อเนื่อง
                  </span>
                </li>
              </ol>
            ) : (
              <div className="space-y-4">
                {isInIframe && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-xs text-amber-200 space-y-2">
                    <p className="font-semibold text-amber-300">
                      กำลังเปิดผ่านหน้าต่างพรีวิว (Iframe)
                    </p>
                    <p className="leading-relaxed text-amber-100/90">
                      เบราว์เซอร์ Android จะแสดงปุ่มติดตั้งแอปอัตโนมัติเมื่อเปิดลิงก์นี้ในแท็บ Chrome โดยตรง
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <code className="flex-1 truncate rounded-lg bg-black/50 px-2.5 py-1.5 font-mono text-[11px] text-white border border-white/10">
                        {appOrigin}
                      </code>
                      <button
                        type="button"
                        onClick={() => void handleCopy(appOrigin, 'url')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white text-black px-3 py-1.5 text-xs font-bold hover:bg-neutral-200 transition shrink-0"
                      >
                        {copiedKey === 'url' ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>คัดลอกลิงก์</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-black/30 border border-white/5 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#1ED760]">
                    วิธีติดตั้งลงมือถือ Android ทันที (WebAPK)
                  </p>
                  <ol className="space-y-2.5 text-sm text-[#D4D4D4] leading-relaxed">
                    <li className="flex items-start gap-2.5">
                      <span className="font-mono text-[#1ED760] font-semibold">1.</span>
                      <span>
                        เปิดเว็บแอปนี้ด้วย <strong className="text-white">Google Chrome</strong>{' '}
                        บนมือถือ Android
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="font-mono text-[#1ED760] font-semibold">2.</span>
                      <span>
                        แตะเมนู <strong className="text-white">จุด 3 จุด (⋮)</strong> มุมขวาบน →
                        เลือก <strong className="text-white">ติดตั้งแอป (Install app)</strong> หรือ{' '}
                        <strong className="text-white">เพิ่มลงในหน้าจอหลัก</strong>
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="font-mono text-[#1ED760] font-semibold">3.</span>
                      <span>
                        ระบบ Android จะสร้างแอป Spotiflow แยกต่างหาก พร้อมทางลัดกดค้างไอคอน (สุ่มออฟไลน์ /
                        แผ่นเสียง / Drive) และเล่นออฟไลน์ได้เต็มรูปแบบ
                      </span>
                    </li>
                  </ol>
                </div>

                <div className="rounded-xl bg-[#16181A] border border-white/10 p-3.5 flex items-start gap-3">
                  <BatteryCharging className="w-5 h-5 text-[#1ED760] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#D4D4D4] leading-relaxed space-y-1">
                    <p className="font-semibold text-white">
                      เคล็ดลับเล่นเพลงต่อเนื่องเมื่อปิดหน้าจอบน Android
                    </p>
                    <p>
                      หากระบบ Android ประหยัดแบตจนตัดเสียงเมื่อล็อกจอนาน ให้ไปที่{' '}
                      <span className="text-white font-medium">
                        การตั้งค่า Android → แอป → Spotiflow (หรือ Chrome) → แบตเตอรี่ → ไม่จำกัด (Unrestricted)
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-black/40 border border-white/10 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                      <Terminal className="w-3.5 h-3.5 text-[#1ED760]" />
                      <span>สร้างไฟล์ .APK / Play Store (.AAB) ด้วย Bubblewrap TWA</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopy(twaCommand, 'twa')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1ED760] hover:underline shrink-0"
                    >
                      {copiedKey === 'twa' ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>คัดลอกคำสั่ง</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-[#A7A7A7] bg-black/60 rounded-lg p-2.5 overflow-x-auto border border-white/5">
                    {twaCommand}
                  </pre>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full rounded-full bg-[#1DB954] hover:bg-[#1ED760] py-2.5 text-sm font-bold text-black transition min-h-[44px]"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}
    </>
  );
};
