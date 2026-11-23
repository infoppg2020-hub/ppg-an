import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Cloud,
  Download,
  Folder,
  HardDriveDownload,
  ListPlus,
  Loader2,
  Play,
  RefreshCw,
  Search,
  WifiOff,
} from 'lucide-react';
import {
  DriveAuthError,
  hashStringToSeed,
  listDriveAudioFiles,
  listDriveFolders,
  parseTrackMetadata,
} from '../services/driveApi';
import { getAccessToken } from '../services/firebaseAuth';
import {
  DownloadProgress,
  DriveAudioFile,
  DriveFolder,
  Track,
} from '../types/music';
import { getTrackAudioQuality } from '../utils/audioQuality';
import { formatBytes } from '../utils/formatters';
import { CoverArt } from './CoverArt';
import { GoogleSignInButton } from './GoogleSignInButton';
import { HiResBadge } from './HiResBadge';

interface DriveBrowserViewProps {
  isOnline: boolean;
  isSignedIn: boolean;
  isLoggingIn: boolean;
  userEmail?: string | null;
  tracksById: Record<string, Track>;
  downloads: Record<string, DownloadProgress>;
  currentTrackId: string | null;
  isPlaying: boolean;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  onRegisterDriveTracks: (tracks: Track[]) => Promise<void>;
  onPlayDriveTracks: (tracks: Track[], startTrackId: string) => void;
  onDownloadTrackOffline: (track: Track) => Promise<void>;
  onDownloadBatchOffline: (tracks: Track[]) => Promise<void>;
  onAddToPlaylist: (track: Track) => void;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const DriveBrowserView: React.FC<DriveBrowserViewProps> = ({
  isOnline,
  isSignedIn,
  isLoggingIn,
  userEmail,
  tracksById,
  downloads,
  currentTrackId,
  isPlaying,
  onLogin,
  onLogout,
  onRegisterDriveTracks,
  onPlayDriveTracks,
  onDownloadTrackOffline,
  onDownloadBatchOffline,
  onAddToPlaylist,
  onNotify,
}) => {
  const [browseAllMode, setBrowseAllMode] = useState(true);
  const [folderStack, setFolderStack] = useState<DriveFolder[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveAudioFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const currentFolder = folderStack[folderStack.length - 1];

  const toTrack = useCallback(
    (file: DriveAudioFile): Track => {
      const id = `drive_${file.id}`;
      const existing = tracksById[id];
      if (existing) {
        return {
          ...existing,
          fileName: existing.fileName || file.name,
          size: file.size || existing.size,
          mimeType: file.mimeType || existing.mimeType,
        };
      }
      const parsed = parseTrackMetadata(file.name);
      return {
        id,
        driveFileId: file.id,
        title: parsed.title,
        artist: parsed.artist,
        album: browseAllMode ? 'Google Drive' : currentFolder.name,
        mimeType: file.mimeType || 'audio/mpeg',
        size: file.size || 0,
        duration: 0,
        source: 'drive',
        isOfflineCached: false,
        addedAt: Date.now(),
        liked: false,
        coverSeed: hashStringToSeed(file.id + file.name),
        folderName: browseAllMode ? 'My Drive' : currentFolder.name,
        fileName: file.name,
      };
    },
    [browseAllMode, currentFolder.name, tracksById]
  );

  const loadDriveContent = useCallback(
    async (append = false, pageToken?: string) => {
      const token = getAccessToken();
      if (!token || !isOnline) return;

      setIsLoading(true);
      setErrorText(null);
      try {
        if (!append && !browseAllMode) {
          const folderRes = await listDriveFolders(
            token,
            currentFolder.id === 'root' ? undefined : currentFolder.id
          );
          setFolders(folderRes);
        } else if (!append) {
          setFolders([]);
        }

        const audioRes = await listDriveAudioFiles(token, {
          folderId: browseAllMode ? null : currentFolder.id,
          searchQuery: searchTerm.trim() || undefined,
          pageToken,
        });

        const nextFiles = append
          ? [...driveFiles, ...audioRes.files]
          : audioRes.files;
        setDriveFiles(nextFiles);
        setNextPageToken(audioRes.nextPageToken);

        if (audioRes.files.length > 0) {
          const mapped = audioRes.files.map(toTrack);
          await onRegisterDriveTracks(mapped);
        }
      } catch (err) {
        if (err instanceof DriveAuthError) {
          setErrorText(err.message);
          onNotify(err.message, 'info');
        } else {
          setErrorText(
            err instanceof Error
              ? err.message
              : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Drive'
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      browseAllMode,
      currentFolder.id,
      driveFiles,
      isOnline,
      onNotify,
      onRegisterDriveTracks,
      searchTerm,
      toTrack,
    ]
  );

  useEffect(() => {
    if (isSignedIn && isOnline) {
      void loadDriveContent(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, isOnline, browseAllMode, currentFolder.id]);

  if (!isOnline) {
    return (
      <div className="rounded-2xl bg-[#181818] border border-white/5 p-8 text-center max-w-xl mx-auto my-8 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto">
          <WifiOff className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">คุณกำลังอยู่ในโหมดออฟไลน์</h2>
        <p className="text-sm text-[#A7A7A7] leading-relaxed">
          ไม่สามารถเชื่อมต่อ Google Drive ได้ในขณะนี้ แต่คุณยังสามารถฟังและสุ่มเพลงในเพลย์ลิสต์ที่บันทึกไว้แบบออฟไลน์ได้ตามปกติ
        </p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="rounded-2xl bg-[#181818] border border-white/5 p-6 sm:p-10 max-w-2xl mx-auto my-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#1DB954]/15 text-[#1ED760] flex items-center justify-center shrink-0">
            <Cloud className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              เชื่อมต่อคลังเพลง Google Drive
            </h2>
            <p className="text-sm text-[#A7A7A7] mt-1 leading-relaxed">
              เข้าสู่ระบบด้วยบัญชี Google เพื่อเรียกดูไฟล์เสียง (.mp3, .m4a, .flac, .wav, .ogg) จาก Google Drive ของคุณ และดาวน์โหลดเก็บไว้ในเพลย์ลิสต์ส่วนตัวเพื่อฟังแบบออฟไลน์
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#D4D4D4]">
          <div className="rounded-xl bg-white/[0.04] p-4 space-y-1">
            <p className="font-semibold text-white">สตรีมและโหลดเก็บออฟไลน์</p>
            <p className="text-[#A7A7A7]">เลือกโหลดเฉพาะเพลงหรือทั้งโฟลเดอร์เก็บไว้ในเครื่อง</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-4 space-y-1">
            <p className="font-semibold text-white">จัดเพลย์ลิสต์ส่วนตัว</p>
            <p className="text-[#A7A7A7]">จัดลำดับและสุ่มเพลงได้โดยไม่ต้องพึ่งอินเทอร์เน็ต</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-4 space-y-1">
            <p className="font-semibold text-white">เล่นต่อเนื่องเมื่อปิดหน้าจอ</p>
            <p className="text-[#A7A7A7]">รองรับปุ่มควบคุมบนหน้าจอล็อกและเล่นข้ามเพลงอัตโนมัติ</p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-4">
          <GoogleSignInButton
            onClick={() => void onLogin()}
            disabled={isLoggingIn}
            label={isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'Sign in with Google'}
          />
          <span className="text-xs text-[#A7A7A7]">
            ขอสิทธิ์อ่านไฟล์จาก Google Drive เท่านั้น (Read-only)
          </span>
        </div>
      </div>
    );
  }

  const mappedTracks = driveFiles.map(toTrack);
  const uncachedTracks = mappedTracks.filter((t) => !t.isOfflineCached);

  return (
    <div className="space-y-6">
      {/* Top Drive Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            เพลงใน Google Drive
          </h1>
          <p className="text-xs text-[#A7A7A7] mt-1">
            บัญชีที่เชื่อมต่อ: {userEmail || 'Google Account'} · พบไฟล์เสียง {driveFiles.length} เพลง
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-[#181818] border border-white/10">
            <button
              type="button"
              onClick={() => setBrowseAllMode(true)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                browseAllMode
                  ? 'bg-[#282828] text-white'
                  : 'text-[#A7A7A7] hover:text-white'
              }`}
            >
              เพลงทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setBrowseAllMode(false)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                !browseAllMode
                  ? 'bg-[#282828] text-white'
                  : 'text-[#A7A7A7] hover:text-white'
              }`}
            >
              ดูตามโฟลเดอร์
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadDriveContent(false)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#181818] hover:bg-[#282828] border border-white/10 text-xs font-semibold text-white transition min-h-[40px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            onClick={() => void onLogout()}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#A7A7A7] hover:text-white transition min-h-[40px]"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Search & Batch Download Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadDriveContent(false);
          }}
          className="relative flex-1 max-w-md"
        >
          <Search className="w-4 h-4 text-[#A7A7A7] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อเพลงใน Google Drive..."
            className="w-full rounded-full bg-[#181818] border border-white/10 pl-10 pr-20 py-2.5 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#1DB954]"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-full bg-[#282828] hover:bg-[#3E3E3E] text-xs font-semibold text-white transition"
          >
            ค้นหา
          </button>
        </form>

        {uncachedTracks.length > 0 && (
          <button
            type="button"
            onClick={() => void onDownloadBatchOffline(uncachedTracks)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1DB954] hover:bg-[#1ED760] px-5 py-2.5 text-xs font-bold text-black transition min-h-[44px] whitespace-nowrap shrink-0"
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>บันทึกทั้งหมดเก็บออฟไลน์ ({uncachedTracks.length})</span>
          </button>
        )}
      </div>

      {/* Folder Breadcrumbs & Subfolders */}
      {!browseAllMode && (
        <div className="space-y-3">
          <div className="flex items-center flex-wrap gap-1.5 text-xs text-[#A7A7A7]">
            {folderStack.map((folder, idx) => (
              <React.Fragment key={folder.id}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5" />}
                <button
                  type="button"
                  onClick={() => setFolderStack(folderStack.slice(0, idx + 1))}
                  className={`px-2 py-1 rounded-md transition ${
                    idx === folderStack.length - 1
                      ? 'text-white font-semibold bg-white/10'
                      : 'hover:text-white'
                  }`}
                >
                  {folder.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          {folders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setFolderStack([...folderStack, folder])}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#181818] hover:bg-[#282828] border border-white/5 text-left transition min-h-[52px]"
                >
                  <Folder className="w-5 h-5 text-[#1ED760] shrink-0" />
                  <span className="text-sm font-medium text-white truncate">
                    {folder.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {errorText && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-red-300">{errorText}</p>
          <GoogleSignInButton
            onClick={() => void onLogin()}
            label="เชื่อมต่อ Google Drive อีกครั้ง"
          />
        </div>
      )}

      {/* Audio Files List */}
      {isLoading && driveFiles.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#A7A7A7]">
          <Loader2 className="w-7 h-7 animate-spin text-[#1ED760]" />
          <p className="text-sm">กำลังดึงรายชื่อเพลงจาก Google Drive...</p>
        </div>
      ) : mappedTracks.length === 0 ? (
        <div className="rounded-2xl bg-[#181818] border border-white/5 p-10 text-center space-y-2">
          <p className="text-base font-semibold text-white">ไม่พบไฟล์เพลงในตำแหน่งนี้</p>
          <p className="text-xs text-[#A7A7A7]">
            รองรับไฟล์เสียง MP3, M4A, FLAC, WAV, OGG, AAC และ OPUS บน Google Drive
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#181818]/70 border border-white/5 divide-y divide-white/5 overflow-hidden">
          {mappedTracks.map((track) => {
            const isCurrent = currentTrackId === track.id;
            const dl = downloads[track.id];
            const quality = getTrackAudioQuality(track);

            return (
              <div
                key={track.id}
                onClick={() => onPlayDriveTracks(mappedTracks, track.id)}
                className={`flex items-center justify-between gap-3 p-3 hover:bg-white/[0.07] cursor-pointer transition min-h-[64px] ${
                  isCurrent ? 'bg-white/[0.08]' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <CoverArt
                    seed={track.coverSeed}
                    size="xs"
                    isPlaying={isCurrent && isPlaying}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isCurrent ? 'text-[#1ED760]' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </p>
                      {quality.isHiRes && (
                        <HiResBadge size="xs" specLabel={quality.specLabel} />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#A7A7A7] truncate">
                      <span className="truncate">{track.artist}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums shrink-0">
                        {formatBytes(track.size)}
                      </span>
                      {dl && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#1ED760] font-mono tabular-nums">
                            กำลังโหลด {dl.percent}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onPlayDriveTracks(mappedTracks, track.id)}
                    title="เล่นเพลง"
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[#A7A7A7] hover:text-white hover:bg-white/10 transition"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>

                  <button
                    type="button"
                    onClick={() => void onDownloadTrackOffline(track)}
                    disabled={Boolean(dl)}
                    title={
                      track.isOfflineCached
                        ? 'บันทึกแบบออฟไลน์แล้ว'
                        : 'ดาวน์โหลดเก็บแบบออฟไลน์'
                    }
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                      track.isOfflineCached
                        ? 'text-[#1ED760]'
                        : 'text-[#A7A7A7] hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {dl ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#1ED760]" />
                    ) : track.isOfflineCached ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onAddToPlaylist(track)}
                    title="เพิ่มเข้าเพลย์ลิสต์"
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[#A7A7A7] hover:text-white hover:bg-white/10 transition"
                  >
                    <ListPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {nextPageToken && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void loadDriveContent(true, nextPageToken)}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition min-h-[44px]"
          >
            {isLoading ? 'กำลังโหลดเพิ่ม...' : 'โหลดเพลงเพิ่มเติม'}
          </button>
        </div>
      )}
    </div>
  );
};
