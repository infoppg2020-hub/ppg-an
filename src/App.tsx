import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Cloud,
  Disc3,
  FolderOpen,
  Home,
  Info,
  Library,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ShieldCheck,
  Sliders,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AuthModal } from './components/AuthModal';
import { DriveBrowserView } from './components/DriveBrowserView';
import { EqualizerModal } from './components/EqualizerModal';
import { HomeView } from './components/HomeView';
import { LibraryView } from './components/LibraryView';
import { AddToPlaylistModal, PlaylistFormModal } from './components/Modals';
import { NowPlayingStageView } from './components/NowPlayingStageView';
import { PlayerBar } from './components/PlayerBar';
import { PlaylistView } from './components/PlaylistView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SearchView } from './components/SearchView';
import { CoverArt } from './components/CoverArt';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useWakeLock } from './hooks/useWakeLock';
import {
  downloadDriveAudioBlob,
  DriveAuthError,
  hashStringToSeed,
  parseTrackMetadata,
} from './services/driveApi';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/firebaseAuth';
import {
  deleteAudioBlob,
  deletePlaylistRecord,
  getAllPlaylists,
  getAllTracks,
  getOfflineStorageStats,
  saveAudioBlob,
  savePlaylist,
  upsertTrack,
  upsertTracks,
} from './services/offlineDb';
import {
  clearAppSessionToken,
  fetchPublicConfig,
} from './services/appAuthApi';
import { AppUser, PublicConfig, SystemSettings } from './types/auth';
import { AppTab, DownloadProgress, Playlist, Track } from './types/music';
import { detectBlobAudioSpecs } from './utils/audioQuality';

interface ToastState {
  id: number;
  message: string;
  type: 'success' | 'info' | 'error';
}

const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  adminClaimed: true,
  envPasscodeConfigured: false,
  settings: {
    allowSelfRegistration: true,
    requireAuthForPlayback: false,
    defaultOfflineAutoCache: true,
    maxOfflineQuotaMb: 2048,
    announcementBanner: '',
  },
};

export default function App() {
  const isOnline = useOnlineStatus();
  const wakeLock = useWakeLock();

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [activePlaylistId, setActivePlaylistId] = useState<string>('liked');

  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [storageStats, setStorageStats] = useState<{
    cachedBytes: number;
    cachedCount: number;
  }>({ cachedBytes: 0, cachedCount: 0 });

  const [user, setUser] = useState<User | null>(null);
  const [hasDriveToken, setHasDriveToken] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicConfig>(DEFAULT_PUBLIC_CONFIG);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [eqModalOpen, setEqModalOpen] = useState(false);

  const [downloads, setDownloads] = useState<Record<string, DownloadProgress>>({});
  const [toast, setToast] = useState<ToastState | null>(null);

  const [playlistModal, setPlaylistModal] = useState<{
    open: boolean;
    mode: 'create' | 'rename';
    targetPlaylist?: Playlist;
  }>({ open: false, mode: 'create' });
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'error' = 'success') => {
      const id = Date.now();
      setToast({ id, message, type });
      window.setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 3200);
    },
    []
  );

  const refreshStorageStats = useCallback(async () => {
    const stats = await getOfflineStorageStats();
    setStorageStats({
      cachedBytes: stats.cachedBytes,
      cachedCount: stats.cachedCount,
    });
  }, []);

  // Register PWA service worker for offline shell caching
  useEffect(() => {
    try {
      registerSW({ immediate: true });
    } catch {
      // Ignore SW registration failure in unsupported environments
    }
  }, []);

  const loadPublicConfig = useCallback(async () => {
    try {
      const cfg = await fetchPublicConfig();
      setPublicConfig(cfg);
    } catch {
      // Offline or server unreachable; keep local defaults so offline mode keeps working
    }
  }, []);

  useEffect(() => {
    if (isOnline) {
      void loadPublicConfig();
    }
  }, [isOnline, loadPublicConfig]);

  // Hydrate offline tracks and playlists from IndexedDB immediately (works 100% offline)
  useEffect(() => {
    const hydrate = async () => {
      const [dbTracks, dbPlaylists] = await Promise.all([
        getAllTracks(),
        getAllPlaylists(),
      ]);
      setTracks(dbTracks);
      setPlaylists(dbPlaylists);
      await refreshStorageStats();

      if (typeof window !== 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        if (action === 'stage') {
          setActiveTab('stage');
        } else if (action === 'drive') {
          setActiveTab('drive');
        } else if (action === 'shuffle-offline') {
          setActiveTab('library');
        }
        if (action) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    };
    void hydrate();
  }, [refreshStorageStats]);

  // Listen to Firebase Auth state (keeps token strictly in memory)
  useEffect(() => {
    const unsub = initAuth(
      (authUser) => {
        setUser(authUser);
        setHasDriveToken(Boolean(getAccessToken()));
      },
      (authUser) => {
        setUser(authUser);
        setHasDriveToken(false);
      }
    );
    return () => unsub();
  }, []);

  const tracksById = useMemo(() => {
    const map: Record<string, Track> = {};
    tracks.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [tracks]);

  const handleTrackUpdated = useCallback(
    (updated: Track) => {
      setTracks((prev) => {
        const exists = prev.some((t) => t.id === updated.id);
        return exists
          ? prev.map((t) => (t.id === updated.id ? updated : t))
          : [updated, ...prev];
      });
      void refreshStorageStats();
    },
    [refreshStorageStats]
  );

  const player = useAudioEngine({
    tracksById,
    isOnline,
    autoCacheOnPlay: publicConfig.settings.defaultOfflineAutoCache,
    onTrackUpdated: handleTrackUpdated,
    onRequireAuth: () => setHasDriveToken(false),
    onNotify: showToast,
  });

  const handleAppLogout = useCallback(() => {
    clearAppSessionToken();
    setAppUser(null);
    if (activeTab === 'admin') {
      setActiveTab('home');
    }
    showToast('ออกจากระบบบัญชีผู้ใช้แล้ว', 'info');
  }, [activeTab, showToast]);

  const handleSettingsUpdated = useCallback((nextSettings: SystemSettings) => {
    setPublicConfig((prev) => ({ ...prev, settings: nextSettings }));
  }, []);

  const authGateActive =
    isOnline && publicConfig.settings.requireAuthForPlayback && !appUser;

  const handleGoogleLogin = useCallback(async () => {
    if (!isOnline) {
      showToast('ไม่สามารถเข้าสู่ระบบ Google Drive ได้ขณะออฟไลน์', 'error');
      return;
    }
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setHasDriveToken(true);
        showToast('เชื่อมต่อ Google Drive สำเร็จแล้ว', 'success');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ',
        'error'
      );
    } finally {
      setIsLoggingIn(false);
    }
  }, [isOnline, showToast]);

  const handleGoogleLogout = useCallback(async () => {
    await logout();
    setUser(null);
    setHasDriveToken(false);
    showToast('ออกจากระบบ Google Drive แล้ว (เพลงออฟไลน์ยังอยู่ครบ)', 'info');
  }, [showToast]);

  const registerDriveTracks = useCallback(async (incoming: Track[]) => {
    setTracks((prev) => {
      const map = new Map<string, Track>(prev.map((t) => [t.id, t]));
      incoming.forEach((t) => {
        const existing = map.get(t.id);
        if (existing) {
          map.set(t.id, {
            ...existing,
            title: existing.title || t.title,
            size: t.size || existing.size,
            mimeType: t.mimeType || existing.mimeType,
          });
        } else {
          map.set(t.id, t);
        }
      });
      return Array.from(map.values()).sort((a, b) => b.addedAt - a.addedAt);
    });
    await upsertTracks(incoming);
  }, []);

  const downloadTrackOffline = useCallback(
    async (track: Track) => {
      if (track.isOfflineCached) {
        showToast(`"${track.title}" บันทึกไว้แบบออฟไลน์แล้ว`, 'info');
        return;
      }
      if (!isOnline) {
        showToast('กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อดาวน์โหลดเพลงนี้', 'error');
        return;
      }
      if (!track.driveFileId) return;

      const token = getAccessToken();
      if (!token) {
        setHasDriveToken(false);
        showToast('กรุณาเข้าสู่ระบบ Google Drive อีกครั้งเพื่อดาวน์โหลด', 'info');
        return;
      }

      setDownloads((prev) => ({
        ...prev,
        [track.id]: {
          trackId: track.id,
          title: track.title,
          loaded: 0,
          total: track.size || 0,
          percent: 0,
        },
      }));

      try {
        const blob = await downloadDriveAudioBlob(
          token,
          track.driveFileId,
          track.mimeType,
          (loaded, total) => {
            const effectiveTotal = total || track.size || loaded;
            const percent =
              effectiveTotal > 0
                ? Math.min(99, Math.round((loaded / effectiveTotal) * 100))
                : 50;
            setDownloads((prev) => ({
              ...prev,
              [track.id]: {
                trackId: track.id,
                title: track.title,
                loaded,
                total: effectiveTotal,
                percent,
              },
            }));
          }
        );

        const specs = await detectBlobAudioSpecs(blob);
        await saveAudioBlob(track.id, blob, track.mimeType);
        const updated: Track = {
          ...track,
          fileName: track.fileName || track.title,
          sampleRate: specs.sampleRate ?? track.sampleRate,
          bitDepth: specs.bitDepth ?? track.bitDepth,
          isOfflineCached: true,
          cachedAt: Date.now(),
          size: blob.size || track.size,
        };
        await upsertTrack(updated);
        handleTrackUpdated(updated);
        showToast(`บันทึก "${track.title}" สำหรับฟังออฟไลน์แล้ว`, 'success');
      } catch (err) {
        if (err instanceof DriveAuthError) {
          clearAccessToken();
          setHasDriveToken(false);
        }
        showToast(
          err instanceof Error ? err.message : 'ดาวน์โหลดเพลงไม่สำเร็จ',
          'error'
        );
      } finally {
        setDownloads((prev) => {
          const copy = { ...prev };
          delete copy[track.id];
          return copy;
        });
      }
    },
    [handleTrackUpdated, isOnline, showToast]
  );

  const downloadBatchOffline = useCallback(
    async (targetTracks: Track[]) => {
      const pending = targetTracks.filter((t) => !t.isOfflineCached && t.driveFileId);
      if (pending.length === 0) return;
      showToast(`กำลังบันทึก ${pending.length} เพลงลงเครื่องสำหรับฟังออฟไลน์...`, 'info');
      for (const track of pending) {
        await downloadTrackOffline(track);
      }
      showToast('บันทึกเพลงออฟไลน์ครบเรียบร้อยแล้ว', 'success');
    },
    [downloadTrackOffline, showToast]
  );

  const toggleTrackOffline = useCallback(
    async (track: Track) => {
      if (track.isOfflineCached) {
        if (track.source === 'local') {
          showToast('ไฟล์เสียงจากเครื่องถูกเก็บแบบออฟไลน์ถาวร', 'info');
          return;
        }
        await deleteAudioBlob(track.id);
        player.clearCachedUrlForTrack(track.id);
        const updated: Track = {
          ...track,
          isOfflineCached: false,
          cachedAt: undefined,
        };
        await upsertTrack(updated);
        handleTrackUpdated(updated);
        showToast(`ลบแคชออฟไลน์ของ "${track.title}" แล้ว`, 'info');
      } else {
        await downloadTrackOffline(track);
      }
    },
    [downloadTrackOffline, handleTrackUpdated, player, showToast]
  );

  const handleImportLocalFiles = useCallback(
    async (fileList: FileList) => {
      const files = Array.from(fileList);
      const imported: Track[] = [];

      for (const file of files) {
        if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|flac|wav|ogg|aac|opus|aiff|aif|dsf|dff|alac)$/i.test(file.name)) {
          continue;
        }
        const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const parsed = parseTrackMetadata(file.name);
        const specs = await detectBlobAudioSpecs(file);
        await saveAudioBlob(id, file, file.type || 'audio/mpeg');
        const newTrack: Track = {
          id,
          title: parsed.title,
          fileName: file.name,
          sampleRate: specs.sampleRate,
          bitDepth: specs.bitDepth,
          artist: parsed.artist === 'Google Drive Audio' ? 'ไฟล์ในเครื่อง' : parsed.artist,
          album: 'คลังเพลงในเครื่อง',
          mimeType: file.type || 'audio/mpeg',
          size: file.size,
          duration: 0,
          source: 'local',
          isOfflineCached: true,
          cachedAt: Date.now(),
          addedAt: Date.now(),
          liked: false,
          coverSeed: hashStringToSeed(id + file.name),
        };
        await upsertTrack(newTrack);
        imported.push(newTrack);
      }

      if (imported.length > 0) {
        setTracks((prev) => [...imported, ...prev]);
        await refreshStorageStats();
        showToast(`นำเข้าเพลงออฟไลน์ ${imported.length} เพลงเรียบร้อยแล้ว`, 'success');
      } else {
        showToast('ไม่พบไฟล์เสียงที่รองรับในรายการที่เลือก', 'error');
      }
    },
    [refreshStorageStats, showToast]
  );

  const toggleLikeTrack = useCallback(
    async (trackId: string) => {
      const target = tracksById[trackId];
      if (!target) return;

      const nextLiked = !target.liked;
      const updatedTrack: Track = { ...target, liked: nextLiked };
      await upsertTrack(updatedTrack);
      setTracks((prev) => prev.map((t) => (t.id === trackId ? updatedTrack : t)));

      const likedPl = playlists.find((p) => p.id === 'liked');
      if (likedPl) {
        const nextIds = nextLiked
          ? Array.from(new Set([trackId, ...likedPl.trackIds]))
          : likedPl.trackIds.filter((id) => id !== trackId);
        const updatedPl: Playlist = {
          ...likedPl,
          trackIds: nextIds,
          updatedAt: Date.now(),
        };
        await savePlaylist(updatedPl);
        setPlaylists((prev) => prev.map((p) => (p.id === 'liked' ? updatedPl : p)));
      }

      showToast(
        nextLiked ? 'เพิ่มลงในเพลงที่ถูกใจแล้ว' : 'นำออกจากเพลงที่ถูกใจแล้ว',
        'info'
      );
    },
    [playlists, showToast, tracksById]
  );

  const handleCreateOrRenamePlaylist = useCallback(
    async (name: string, description: string) => {
      if (playlistModal.mode === 'rename' && playlistModal.targetPlaylist) {
        const updated: Playlist = {
          ...playlistModal.targetPlaylist,
          name,
          description,
          updatedAt: Date.now(),
        };
        await savePlaylist(updated);
        setPlaylists((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
        showToast('อัปเดตข้อมูลเพลย์ลิสต์แล้ว', 'success');
        return;
      }

      const newPlaylist: Playlist = {
        id: `pl_${Date.now()}`,
        name,
        description,
        trackIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        coverSeed: hashStringToSeed(name + Date.now()),
      };
      await savePlaylist(newPlaylist);
      setPlaylists((prev) => {
        const system = prev.filter((p) => p.isSystem);
        const custom = prev.filter((p) => !p.isSystem);
        return [...system, newPlaylist, ...custom];
      });
      setActivePlaylistId(newPlaylist.id);
      setActiveTab('playlist');
      showToast(`สร้างเพลย์ลิสต์ "${name}" เรียบร้อยแล้ว`, 'success');
    },
    [playlistModal, showToast]
  );

  const handleToggleTrackInPlaylist = useCallback(
    async (playlistId: string, track: Track) => {
      // Ensure track exists in IndexedDB first
      if (!tracksById[track.id]) {
        await upsertTrack(track);
        setTracks((prev) => [track, ...prev]);
      }

      const targetPl = playlists.find((p) => p.id === playlistId);
      if (!targetPl) return;

      const exists = targetPl.trackIds.includes(track.id);
      const nextTrackIds = exists
        ? targetPl.trackIds.filter((id) => id !== track.id)
        : [...targetPl.trackIds, track.id];

      const updatedPl: Playlist = {
        ...targetPl,
        trackIds: nextTrackIds,
        updatedAt: Date.now(),
      };
      await savePlaylist(updatedPl);
      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? updatedPl : p))
      );

      if (playlistId === 'liked') {
        const updatedTrack: Track = { ...track, liked: !exists };
        await upsertTrack(updatedTrack);
        setTracks((prev) =>
          prev.map((t) => (t.id === track.id ? updatedTrack : t))
        );
      }

      showToast(
        exists
          ? `นำ "${track.title}" ออกจาก "${targetPl.name}" แล้ว`
          : `เพิ่ม "${track.title}" ลง "${targetPl.name}" แล้ว`,
        'success'
      );
    },
    [playlists, showToast, tracksById]
  );

  const handleReorderPlaylistTrack = useCallback(
    async (playlistId: string, fromIdx: number, toIdx: number) => {
      const targetPl = playlists.find((p) => p.id === playlistId);
      if (!targetPl) return;
      const nextIds = [...targetPl.trackIds];
      const [moved] = nextIds.splice(fromIdx, 1);
      nextIds.splice(toIdx, 0, moved);

      const updatedPl: Playlist = {
        ...targetPl,
        trackIds: nextIds,
        updatedAt: Date.now(),
      };
      await savePlaylist(updatedPl);
      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? updatedPl : p))
      );
    },
    [playlists]
  );

  const handleDeletePlaylist = useCallback(
    async (playlistId: string) => {
      await deletePlaylistRecord(playlistId);
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      setActiveTab('home');
      showToast('ลบเพลย์ลิสต์เรียบร้อยแล้ว', 'info');
    },
    [showToast]
  );

  const handlePlayDriveTracks = useCallback(
    (driveTracks: Track[], startTrackId: string) => {
      const ids = driveTracks.map((t) => t.id);
      void player.playFromList(ids, startTrackId, false);
    },
    [player]
  );

  const openPlaylist = (id: string) => {
    setActivePlaylistId(id);
    setActiveTab('playlist');
  };

  const activePlaylist =
    playlists.find((p) => p.id === activePlaylistId) || playlists[0];
  const activePlaylistTracks = activePlaylist
    ? activePlaylist.trackIds
        .map((id) => tracksById[id])
        .filter((t): t is Track => Boolean(t))
    : [];

  return (
    <div className="h-screen w-full bg-black text-white flex flex-col overflow-hidden select-none">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-sm rounded-full px-4 py-2.5 shadow-2xl flex items-center gap-2.5 text-xs font-semibold transition-all ${
            toast.type === 'error'
              ? 'bg-red-500 text-white'
              : toast.type === 'info'
              ? 'bg-[#282828] text-white border border-white/15'
              : 'bg-[#1DB954] text-black'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <Info className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate">{toast.message}</span>
        </div>
      )}

      {/* Workspace Shell */}
      <div className="flex-1 flex overflow-hidden md:p-2 md:gap-2 min-h-0">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={`hidden md:flex flex-col gap-2 shrink-0 transition-[width] duration-200 ${
            isSidebarCollapsed ? 'w-[76px]' : 'w-72 lg:w-80'
          }`}
        >
          {/* Brand + Main Nav */}
          <div className="bg-[#121212] rounded-xl p-3 space-y-3">
            <div
              className={`flex items-center ${
                isSidebarCollapsed ? 'justify-center' : 'justify-between px-1'
              }`}
            >
              {!isSidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setActiveTab('home')}
                  className="flex items-center gap-3 group min-w-0"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1ED760] to-[#149642] flex items-center justify-center shadow-lg shadow-[#1DB954]/20 group-hover:scale-105 transition-transform shrink-0">
                    <svg
                      className="w-5 h-5 text-black"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    >
                      <path d="M4 10v4" />
                      <path d="M8 7v10" />
                      <path d="M12 4v16" />
                      <path d="M16 8v8" />
                      <path d="M20 11v2" />
                    </svg>
                  </div>
                  <span
                    className="text-xl font-extrabold tracking-tight text-white truncate"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Spotiflow
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                title={isSidebarCollapsed ? 'ขยายแถบด้านข้าง' : 'ย่อแถบด้านข้าง'}
                className="w-9 h-9 rounded-lg hover:bg-[#282828] flex items-center justify-center text-[#A7A7A7] hover:text-white transition shrink-0"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-5 h-5" />
                ) : (
                  <PanelLeftClose className="w-5 h-5" />
                )}
              </button>
            </div>

            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                title="หน้าหลัก"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center px-0' : 'gap-3.5 px-3'
                } py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'home'
                    ? 'bg-[#282828] text-white'
                    : 'text-[#A7A7A7] hover:text-white'
                }`}
              >
                <Home className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span>หน้าหลัก</span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('drive')}
                title="Google Drive"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center px-0' : 'gap-3.5 px-3'
                } py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'drive'
                    ? 'bg-[#282828] text-white'
                    : 'text-[#A7A7A7] hover:text-white'
                }`}
              >
                <Cloud className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span>Google Drive</span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('search')}
                title="ค้นหาออฟไลน์"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center px-0' : 'gap-3.5 px-3'
                } py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'search'
                    ? 'bg-[#282828] text-white'
                    : 'text-[#A7A7A7] hover:text-white'
                }`}
              >
                <Search className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span>ค้นหาออฟไลน์</span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('stage')}
                title="หน้าปกใหญ่ / แผ่นเสียง / เทป"
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center px-0' : 'gap-3.5 px-3'
                } py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'stage'
                    ? 'bg-[#282828] text-[#1ED760]'
                    : 'text-[#A7A7A7] hover:text-white'
                }`}
              >
                <Disc3 className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span>หน้าปก / แผ่นเสียง / เทป</span>}
              </button>

              {appUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  title="จัดการระบบ (Admin)"
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? 'justify-center px-0' : 'gap-3.5 px-3'
                  } py-2.5 rounded-lg text-sm font-semibold transition ${
                    activeTab === 'admin'
                      ? 'bg-[#282828] text-[#1ED760]'
                      : 'text-[#A7A7A7] hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span>จัดการระบบ (Admin)</span>}
                </button>
              )}
            </nav>
          </div>

          {/* Offline Playlists Sidebar */}
          <div className="bg-[#121212] rounded-xl flex-1 flex flex-col overflow-hidden">
            <div
              className={`p-3.5 flex items-center border-b border-white/5 ${
                isSidebarCollapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              {!isSidebarCollapsed && (
                <div className="flex items-center gap-2.5 text-sm font-semibold text-[#D4D4D4]">
                  <Library className="w-5 h-5 text-[#1ED760]" />
                  <span>เพลย์ลิสต์ส่วนตัว</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setPlaylistModal({ open: true, mode: 'create' })}
                title="สร้างเพลย์ลิสต์ใหม่"
                className="w-9 h-9 rounded-full hover:bg-[#282828] flex items-center justify-center text-[#A7A7A7] hover:text-white transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {playlists.map((pl) => {
                const isActive =
                  activeTab === 'playlist' && activePlaylistId === pl.id;
                return (
                  <button
                    key={pl.id}
                    type="button"
                    title={pl.name}
                    onClick={() => openPlaylist(pl.id)}
                    className={`w-full flex items-center ${
                      isSidebarCollapsed ? 'justify-center p-1.5' : 'gap-3 p-2'
                    } rounded-lg text-left transition ${
                      isActive ? 'bg-[#282828]' : 'hover:bg-[#1E1E1E]'
                    }`}
                  >
                    <CoverArt
                      seed={pl.coverSeed}
                      isLikedPlaylist={pl.id === 'liked'}
                      size="sm"
                    />
                    {!isSidebarCollapsed && (
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold truncate ${
                            isActive ? 'text-[#1ED760]' : 'text-white'
                          }`}
                        >
                          {pl.name}
                        </p>
                        <p className="text-xs text-[#A7A7A7] truncate tabular-nums">
                          เพลย์ลิสต์ · {pl.trackIds.length} เพลง
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content View */}
        <main className="flex-1 bg-[#121212] md:rounded-xl overflow-y-auto flex flex-col min-w-0">
          {/* Top Bar (Scrolls on mobile to respect 15% mobile sticky cap; sticky on desktop) */}
          <header className="md:sticky md:top-0 z-20 bg-[#121212]/90 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between gap-4 border-b border-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="md:hidden flex items-center gap-2 shrink-0"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1ED760] to-[#149642] flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-black"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  >
                    <path d="M4 10v4" />
                    <path d="M8 7v10" />
                    <path d="M12 4v16" />
                    <path d="M16 8v8" />
                    <path d="M20 11v2" />
                  </svg>
                </div>
                <span
                  className="font-extrabold text-base tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Spotiflow
                </span>
              </button>

              {!isOnline && (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/25 px-3 py-1.5 rounded-lg whitespace-nowrap">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>โหมดออฟไลน์ · ใช้ข้อมูลในเครื่อง</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <PWAInstallButton />

              <button
                type="button"
                onClick={() =>
                  setActiveTab((prev) => (prev === 'stage' ? 'home' : 'stage'))
                }
                title="หน้าปกใหญ่ / แผ่นเสียง / เทป"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition min-h-[40px] whitespace-nowrap shrink-0 ${
                  activeTab === 'stage'
                    ? 'bg-[#1DB954] text-black'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <Disc3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">เล่นเต็มจอ</span>
              </button>

              <button
                type="button"
                onClick={() => setEqModalOpen(true)}
                title="Equalizer (EQ)"
                className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition min-h-[40px] whitespace-nowrap shrink-0 ${
                  player.eqState.enabled && player.eqState.preset !== 'flat'
                    ? 'bg-[#1DB954]/15 text-[#1ED760] border border-[#1DB954]/30'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>EQ</span>
              </button>

              {appUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`md:hidden inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-semibold transition min-h-[40px] whitespace-nowrap shrink-0 ${
                    activeTab === 'admin'
                      ? 'bg-[#1DB954] text-black'
                      : 'bg-white/10 text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('drive')}
                className={`hidden md:inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition min-h-[40px] whitespace-nowrap shrink-0 ${
                  hasDriveToken
                    ? 'bg-[#1DB954]/15 text-[#1ED760] border border-[#1DB954]/30'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>
                  {hasDriveToken
                    ? user?.displayName || 'เชื่อมต่อ Drive แล้ว'
                    : 'เชื่อมต่อ Google Drive'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition min-h-[40px] whitespace-nowrap shrink-0 ${
                  appUser
                    ? 'bg-[#282828] hover:bg-[#3E3E3E] text-white border border-white/10'
                    : 'bg-[#1DB954] hover:bg-[#1ED760] text-black'
                }`}
              >
                {appUser?.role === 'admin' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1ED760]" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                <span>{appUser ? appUser.displayName : 'เข้าสู่ระบบ'}</span>
              </button>
            </div>
          </header>

          {/* Active Page Content */}
          <div className="p-4 sm:p-6 pb-8 flex-1 space-y-5">
            {publicConfig.settings.announcementBanner && (
              <div className="rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/25 px-4 py-3 flex items-center gap-3 text-xs sm:text-sm text-[#E5E7EB]">
                <Megaphone className="w-4 h-4 text-[#1ED760] shrink-0" />
                <span className="break-words">{publicConfig.settings.announcementBanner}</span>
              </div>
            )}
            {activeTab === 'home' && (
              <HomeView
                playlists={playlists}
                tracks={tracks}
                currentTrackId={player.currentTrackId}
                isPlaying={player.isPlaying}
                isOnline={isOnline}
                isSignedIn={hasDriveToken}
                downloads={downloads}
                storageStats={storageStats}
                onOpenPlaylist={openPlaylist}
                onCreatePlaylist={() =>
                  setPlaylistModal({ open: true, mode: 'create' })
                }
                onOpenDrive={() => setActiveTab('drive')}
                onImportLocalFiles={(files) => void handleImportLocalFiles(files)}
                onPlayTracks={(ids, startId, shuffle) =>
                  void player.playFromList(ids, startId, shuffle)
                }
                onToggleLike={(id) => void toggleLikeTrack(id)}
                onToggleOffline={(track) => void toggleTrackOffline(track)}
                onAddToPlaylist={(track) => setPickerTrack(track)}
              />
            )}

            {activeTab === 'drive' && (
              <DriveBrowserView
                isOnline={isOnline}
                isSignedIn={hasDriveToken}
                isLoggingIn={isLoggingIn}
                userEmail={user?.email}
                tracksById={tracksById}
                downloads={downloads}
                currentTrackId={player.currentTrackId}
                isPlaying={player.isPlaying}
                onLogin={handleGoogleLogin}
                onLogout={handleGoogleLogout}
                onRegisterDriveTracks={registerDriveTracks}
                onPlayDriveTracks={handlePlayDriveTracks}
                onDownloadTrackOffline={downloadTrackOffline}
                onDownloadBatchOffline={downloadBatchOffline}
                onAddToPlaylist={(track) => setPickerTrack(track)}
                onNotify={showToast}
              />
            )}

            {activeTab === 'search' && (
              <SearchView
                tracks={tracks}
                playlists={playlists}
                currentTrackId={player.currentTrackId}
                isPlaying={player.isPlaying}
                isOnline={isOnline}
                downloads={downloads}
                onPlayTracks={(ids, startId, shuffle) =>
                  void player.playFromList(ids, startId, shuffle)
                }
                onOpenPlaylist={openPlaylist}
                onToggleLike={(id) => void toggleLikeTrack(id)}
                onToggleOffline={(track) => void toggleTrackOffline(track)}
                onAddToPlaylist={(track) => setPickerTrack(track)}
              />
            )}

            {activeTab === 'library' && (
              <LibraryView
                playlists={playlists}
                tracks={tracks}
                storageStats={storageStats}
                onOpenPlaylist={openPlaylist}
                onCreatePlaylist={() =>
                  setPlaylistModal({ open: true, mode: 'create' })
                }
                onShuffleOfflineAll={() => {
                  const offlineIds = tracks
                    .filter((t) => t.isOfflineCached)
                    .map((t) => t.id);
                  void player.playFromList(offlineIds, undefined, true);
                }}
              />
            )}

            {activeTab === 'playlist' && activePlaylist && (
              <PlaylistView
                playlist={activePlaylist}
                tracks={activePlaylistTracks}
                currentTrackId={player.currentTrackId}
                isPlaying={player.isPlaying}
                isOnline={isOnline}
                downloads={downloads}
                onPlaySequential={(ids, startId) =>
                  void player.playFromList(ids, startId, false)
                }
                onShufflePlay={(ids) =>
                  void player.playFromList(ids, undefined, true)
                }
                onDownloadAllOffline={(list) => void downloadBatchOffline(list)}
                onToggleLike={(id) => void toggleLikeTrack(id)}
                onToggleTrackOffline={(track) => void toggleTrackOffline(track)}
                onAddToPlaylist={(track) => setPickerTrack(track)}
                onReorderTrack={(plId, from, to) =>
                  void handleReorderPlaylistTrack(plId, from, to)
                }
                onRemoveTrackFromPlaylist={(plId, trackId) => {
                  const track = tracksById[trackId];
                  if (track) void handleToggleTrackInPlaylist(plId, track);
                }}
                onRenamePlaylist={() =>
                  setPlaylistModal({
                    open: true,
                    mode: 'rename',
                    targetPlaylist: activePlaylist,
                  })
                }
                onDeletePlaylist={(plId) => void handleDeletePlaylist(plId)}
                onNavigateToDrive={() => setActiveTab('drive')}
              />
            )}

            {activeTab === 'admin' && appUser?.role === 'admin' && (
              <AdminDashboardView
                currentUser={appUser}
                storageStats={storageStats}
                onSettingsUpdated={handleSettingsUpdated}
                onNotify={showToast}
              />
            )}

            {activeTab === 'stage' && (
              <NowPlayingStageView
                currentTrack={player.currentTrack}
                isPlaying={player.isPlaying}
                isBuffering={player.isBuffering}
                isShuffle={player.isShuffle}
                repeatMode={player.repeatMode}
                currentTime={player.currentTime}
                duration={player.duration}
                eqState={player.eqState}
                onBack={() => setActiveTab('home')}
                onTogglePlay={() => void player.togglePlay()}
                onPrev={() => void player.prevTrack()}
                onNext={() => void player.nextTrack()}
                onSeek={player.seekTo}
                onToggleShuffle={player.toggleShuffle}
                onCycleRepeat={player.cycleRepeat}
                onToggleLike={(id) => void toggleLikeTrack(id)}
                onOpenEq={() => setEqModalOpen(true)}
              />
            )}
          </div>
        </main>
      </div>

      {/* Persistent Player Bar (Desktop Footer + Mobile Mini-Player) */}
      <PlayerBar
        currentTrack={player.currentTrack}
        queue={player.queue}
        tracksById={tracksById}
        isPlaying={player.isPlaying}
        isBuffering={player.isBuffering}
        isShuffle={player.isShuffle}
        repeatMode={player.repeatMode}
        currentTime={player.currentTime}
        duration={player.duration}
        volume={player.volume}
        isMuted={player.isMuted}
        wakeLockSupported={wakeLock.isSupported}
        wakeLockEnabled={wakeLock.isEnabled}
        eqActive={player.eqState.enabled && player.eqState.preset !== 'flat'}
        isStageOpen={activeTab === 'stage'}
        onTogglePlay={() => void player.togglePlay()}
        onPrev={() => void player.prevTrack()}
        onNext={() => void player.nextTrack()}
        onSeek={player.seekTo}
        onToggleShuffle={player.toggleShuffle}
        onCycleRepeat={player.cycleRepeat}
        onChangeVolume={player.changeVolume}
        onToggleMute={player.toggleMute}
        onToggleLike={(id) => void toggleLikeTrack(id)}
        onToggleWakeLock={() => void wakeLock.toggle()}
        onPlayQueueTrack={(id) => void player.playTrackById(id)}
        onOpenEq={() => setEqModalOpen(true)}
        onOpenStage={() =>
          setActiveTab((prev) => (prev === 'stage' ? 'home' : 'stage'))
        }
      />

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden bg-black/95 border-t border-white/10 grid grid-cols-4 h-14 px-2 shrink-0 z-30">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activeTab === 'home' ? 'text-[#1ED760]' : 'text-[#A7A7A7]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>หน้าหลัก</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drive')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activeTab === 'drive' ? 'text-[#1ED760]' : 'text-[#A7A7A7]'
          }`}
        >
          <Cloud className="w-5 h-5" />
          <span>Drive</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activeTab === 'search' ? 'text-[#1ED760]' : 'text-[#A7A7A7]'
          }`}
        >
          <Search className="w-5 h-5" />
          <span>ค้นหา</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activeTab === 'library' || activeTab === 'playlist'
              ? 'text-[#1ED760]'
              : 'text-[#A7A7A7]'
          }`}
        >
          <Library className="w-5 h-5" />
          <span>คอลเลกชัน</span>
        </button>
      </nav>

      {/* Modals */}
      <PlaylistFormModal
        isOpen={playlistModal.open}
        mode={playlistModal.mode}
        initialName={playlistModal.targetPlaylist?.name}
        initialDescription={playlistModal.targetPlaylist?.description}
        onClose={() => setPlaylistModal({ open: false, mode: 'create' })}
        onSubmit={(name, desc) => void handleCreateOrRenamePlaylist(name, desc)}
      />

      <AddToPlaylistModal
        track={pickerTrack}
        playlists={playlists}
        onClose={() => setPickerTrack(null)}
        onToggleTrackInPlaylist={(plId, track) =>
          void handleToggleTrackInPlaylist(plId, track)
        }
        onRequestCreatePlaylist={() =>
          setPlaylistModal({ open: true, mode: 'create' })
        }
      />

      <AuthModal
        isOpen={authModalOpen || authGateActive}
        canDismiss={!authGateActive}
        isOnline={isOnline}
        currentUser={appUser}
        publicConfig={publicConfig}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(loggedUser) => {
          setAppUser(loggedUser);
          if (loggedUser.role === 'admin') {
            setActiveTab('admin');
          }
        }}
        onLogout={handleAppLogout}
        onConfigChanged={() => void loadPublicConfig()}
        onNotify={showToast}
      />

      <EqualizerModal
        isOpen={eqModalOpen}
        isPlaying={player.isPlaying}
        eqState={player.eqState}
        analyserRef={player.analyserRef}
        onClose={() => setEqModalOpen(false)}
        onToggleEnabled={player.setEqEnabled}
        onChangeBand={player.setEqBand}
        onSelectPreset={player.applyEqPreset}
      />
    </div>
  );
}
