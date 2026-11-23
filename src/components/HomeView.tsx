import React, { useRef } from 'react';
import {
  Cloud,
  FolderPlus,
  HardDrive,
  Play,
  Plus,
  Shuffle,
  Upload,
} from 'lucide-react';
import { DownloadProgress, Playlist, Track } from '../types/music';
import { formatBytes } from '../utils/formatters';
import { CoverArt } from './CoverArt';
import { TrackRow } from './TrackRow';

interface HomeViewProps {
  playlists: Playlist[];
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isOnline: boolean;
  isSignedIn: boolean;
  downloads: Record<string, DownloadProgress>;
  storageStats: { cachedBytes: number; cachedCount: number };
  onOpenPlaylist: (playlistId: string) => void;
  onCreatePlaylist: () => void;
  onOpenDrive: () => void;
  onImportLocalFiles: (files: FileList) => void;
  onPlayTracks: (trackIds: string[], startTrackId?: string, shuffle?: boolean) => void;
  onToggleLike: (trackId: string) => void;
  onToggleOffline: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
}

function getThaiGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'สวัสดีตอนเช้า';
  if (hour < 18) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

export const HomeView: React.FC<HomeViewProps> = ({
  playlists,
  tracks,
  currentTrackId,
  isPlaying,
  isOnline,
  isSignedIn,
  downloads,
  storageStats,
  onOpenPlaylist,
  onCreatePlaylist,
  onOpenDrive,
  onImportLocalFiles,
  onPlayTracks,
  onToggleLike,
  onToggleOffline,
  onAddToPlaylist,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const offlineTracks = tracks.filter((t) => t.isOfflineCached);
  const allTrackIds = tracks.map((t) => t.id);
  const offlineTrackIds = offlineTracks.map((t) => t.id);

  return (
    <div className="space-y-8">
      {/* Greeting + Quick Access Playlists */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {getThaiGreeting()}
            </h1>
            <p className="text-xs text-[#A7A7A7] mt-1">
              คลังเพลงออฟไลน์ส่วนตัว · บันทึกไว้ในเครื่อง {storageStats.cachedCount} เพลง (
              <span className="font-mono tabular-nums">
                {formatBytes(storageStats.cachedBytes)}
              </span>
              )
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {offlineTrackIds.length > 0 && (
              <button
                type="button"
                onClick={() => onPlayTracks(offlineTrackIds, undefined, true)}
                className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] hover:bg-[#1ED760] px-4 py-2.5 text-xs font-bold text-black transition min-h-[42px]"
              >
                <Shuffle className="w-4 h-4" />
                <span>สุ่มเล่นเพลงออฟไลน์ทั้งหมด</span>
              </button>
            )}
            <button
              type="button"
              onClick={onCreatePlaylist}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-4 py-2.5 text-xs font-semibold text-white transition min-h-[42px]"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างเพลย์ลิสต์</span>
            </button>
          </div>
        </div>

        {/* Playlists Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {playlists.slice(0, 6).map((pl) => (
            <div
              key={pl.id}
              onClick={() => onOpenPlaylist(pl.id)}
              className="group rounded-xl bg-white/[0.07] hover:bg-white/[0.14] overflow-hidden flex items-center justify-between pr-3 cursor-pointer transition min-h-[64px]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <CoverArt
                  seed={pl.coverSeed}
                  isLikedPlaylist={pl.id === 'liked'}
                  size="md"
                  className="rounded-none"
                />
                <div className="min-w-0 py-1">
                  <p className="text-sm font-semibold text-white truncate">{pl.name}</p>
                  <p className="text-xs text-[#A7A7A7] tabular-nums">
                    {pl.trackIds.length} เพลง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayTracks(pl.trackIds, undefined, false);
                }}
                title={`เล่น ${pl.name}`}
                className="w-10 h-10 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Source Shortcuts: Google Drive + Local Audio Import */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#181818] border border-white/5 p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#1DB954]/15 text-[#1ED760] flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white">
                {isSignedIn ? 'เปิดคลังเพลง Google Drive' : 'เชื่อมต่อ Google Drive'}
              </h2>
              <p className="text-xs text-[#A7A7A7] mt-1 leading-relaxed">
                เลือกเพลงหรือโฟลเดอร์เพลงจาก Google Drive เพื่อสตรีมและดาวน์โหลดเก็บไว้ฟังแบบออฟไลน์
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenDrive}
            className="px-4 py-2.5 rounded-full bg-white text-black text-xs font-bold hover:bg-neutral-200 transition shrink-0 min-h-[42px]"
          >
            {isSignedIn ? 'เลือกเพลง' : 'เชื่อมต่อ'}
          </button>
        </div>

        <div className="rounded-2xl bg-[#181818] border border-white/5 p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white">นำเข้าไฟล์เสียงจากเครื่อง</h2>
              <p className="text-xs text-[#A7A7A7] mt-1 leading-relaxed">
                เพิ่มไฟล์ MP3, M4A, FLAC, WAV จากอุปกรณ์ของคุณเข้าคลังออฟไลน์ได้ทันที
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onImportLocalFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition shrink-0 min-h-[42px]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>เลือกไฟล์</span>
          </button>
        </div>
      </section>

      {/* Saved Library Tracks */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            เพลงในคลังของคุณ ({tracks.length})
          </h2>
          {tracks.length > 0 && (
            <button
              type="button"
              onClick={() => onPlayTracks(allTrackIds, undefined, true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1ED760] hover:underline min-h-[36px]"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>สุ่มเล่นทั้งหมด</span>
            </button>
          )}
        </div>

        {tracks.length === 0 ? (
          <div className="rounded-2xl bg-[#181818] border border-white/5 p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 text-[#A7A7A7] flex items-center justify-center mx-auto">
              <FolderPlus className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-white">
                ยังไม่มีเพลงในคลังออฟไลน์ของคุณ
              </p>
              <p className="text-xs text-[#A7A7A7] max-w-md mx-auto">
                เริ่มต้นด้วยการเชื่อมต่อ Google Drive เพื่อดึงไฟล์เพลงของคุณ หรือเลือกนำเข้าไฟล์เสียงจากเครื่องเพื่อสร้างเพลย์ลิสต์ส่วนตัว
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={onOpenDrive}
                className="px-5 py-2.5 rounded-full bg-[#1DB954] hover:bg-[#1ED760] text-black text-xs font-bold transition min-h-[44px]"
              >
                เปิด Google Drive
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition min-h-[44px]"
              >
                นำเข้าไฟล์จากเครื่อง
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#181818]/75 border border-white/5 p-1.5 sm:p-3 divide-y divide-white/[0.04]">
            {tracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                isCurrent={currentTrackId === track.id}
                isPlaying={isPlaying}
                isOnline={isOnline}
                downloadProgress={downloads[track.id]}
                onPlay={() => onPlayTracks(allTrackIds, track.id, false)}
                onToggleLike={() => onToggleLike(track.id)}
                onToggleOffline={() => onToggleOffline(track)}
                onAddToPlaylist={() => onAddToPlaylist(track)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
