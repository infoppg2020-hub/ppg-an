import { useCallback, useEffect, useRef, useState } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
}

export function useWakeLock() {
  const [isSupported] = useState<boolean>(
    () => typeof navigator !== 'undefined' && 'wakeLock' in navigator
  );
  const [isEnabled, setIsEnabled] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  const acquire = useCallback(async () => {
    if (!isSupported) return false;
    try {
      const nav = navigator as unknown as {
        wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
      };
      const sentinel = await nav.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      sentinel.addEventListener('release', () => {
        sentinelRef.current = null;
      });
      return true;
    } catch {
      return false;
    }
  }, [isSupported]);

  const release = useCallback(async () => {
    if (sentinelRef.current && !sentinelRef.current.released) {
      try {
        await sentinelRef.current.release();
      } catch {
        // Ignore release errors
      }
    }
    sentinelRef.current = null;
  }, []);

  const toggle = useCallback(async () => {
    if (!isSupported) return false;
    if (isEnabled) {
      await release();
      setIsEnabled(false);
      return false;
    } else {
      const ok = await acquire();
      setIsEnabled(ok);
      return ok;
    }
  }, [acquire, isEnabled, isSupported, release]);

  useEffect(() => {
    if (!isEnabled) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isEnabled && !sentinelRef.current) {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [acquire, isEnabled]);

  useEffect(() => {
    return () => {
      void release();
    };
  }, [release]);

  return { isSupported, isEnabled, toggle };
}
