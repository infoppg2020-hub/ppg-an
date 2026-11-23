import React, { useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  HardDriveDownload,
  Play,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { DownloadProgress, Playlist, Track } from '../types/music';
import { formatBytes, getCoverPalette } from '../utils/formatters';
import { CoverArt } from './CoverArt';
import { ConfirmDialog } from './Modals';
import { TrackRow } from './TrackRow';

interface PlaylistViewProps {
  playlist: Playlist;
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isOnline: boolean;
  downloads: Record<string, DownloadProgress>;
  onPlaySequential: (trackIds: string[], startTrackId?: string) => void;
  onShufflePlay: (trackIds: string[]) => void;
  onDownloadAllOffline: (tracks: Track[]) => void;
  onToggleLike: (trackId: string) => void;
  onToggleTrackOffline: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
  onReorderTrack: (playlistId: string, fromIdx: number, toIdx: number) => void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  onRenamePlaylist: () => void;
  onDeletePlaylist: (playlistId: string) => void;
  onNavigateToDrive: () => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlist,
  tracks,
  currentTrackId,
  isPlaying,
  isOnline,
  downloads,
  onPlaySequential,
  onShufflePlay,
  onDownloadAllOffline,
  onToggleLike,
  onToggleTrackOffline,
  onAddToPlaylist,
  onReorderTrack,
  onRemoveTrackFromPlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onNavigateToDrive,
}) => {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const palette = getCoverPalette(playlist.coverSeed);

  const offlineCount = tracks.filter((t) => t.isOfflineCached).length;
  const totalBytes = tracks.reduce((sum, t) => sum + (t.size || 0), 0);
  const uncachedTracks = tracks.filter((t) => !t.isOfflineCached);
  const trackIds = tracks.map((t) => t.id);

  return (
    <div className="relative space-y-6">
      <div
        className={`absolute -inset-x-6 -top-6 h-72 bg-gradient-to-b ${
          playlist.id === 'liked' ? 'from-indigo-900' : palette.banner
        } to-transparent opacity-55 pointer-events-none rounded-t-xl`}
      />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-5 pt-2">
        <CoverArt
          seed={playlist.coverSeed}
          isLikedPlaylist={playlist.id === 'liked'}
          size="lg"
          className="shadow-2xl"
        />

        <div className="text-center sm:text-left min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold text-[#D4D4D4]">
            เพลย์ลิสต์ส่วนตัวแบบออฟไลน์
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight break-words">
            {playlist.name}
          </h1>
          {playlist.description && (
            <p className="text-sm text-[#D4D4D4] line-clamp-2">{playlist.description}</p>
          )}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-[#A7A7A7] pt-1">
            <span className="font-mono tabular-nums">{tracks.length} เพลง</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#1ED760] font-mono tabular-nums">
              พร้อมฟังออฟไลน์ {offlineCount}/{tracks.length}
            </span>
            {totalBytes > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{formatBytes(totalBytes)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="relative z-10 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onPlaySequential(trackIds)}
          disabled={tracks.length === 0}
          className="inline-flex items-center gap-2.5 rounded-full bg-[#1DB954] hover:bg-[#1ED760] disabled:opacity-40 px-6 py-3 text-sm font-bold text-black shadow-lg transition min-h-[48px]"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>เล่นทั้งหมด</span>
        </button>

        <button
          type="button"
          onClick={() => onShufflePlay(trackIds)}
          disabled={tracks.length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 px-5 py-3 text-sm font-semibold text-white transition min-h-[48px]"
        >
          <Shuffle className="w-4 h-4 text-[#1ED760]" />
          <span>สุ่มเพลงในเพลย์ลิสต์</span>
        </button>

        {uncachedTracks.length > 0 && isOnline && (
          <button
            type="button"
            onClick={() => onDownloadAllOffline(uncachedTracks)}
            className="inline-flex items-center gap-2 rounded-full bg-[#181818] hover:bg-[#282828] border border-white/10 px-4 py-3 text-xs font-semibold text-white transition min-h-[48px]"
          >
            <HardDriveDownload className="w-4 h-4 text-[#1ED760]" />
            <span>บันทึกออฟไลน์ทั้งหมด ({uncachedTracks.length})</span>
          </button>
        )}

        {uncachedTracks.length === 0 && tracks.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1ED760] px-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>พร้อมเล่นแบบออฟไลน์ 100%</span>
          </span>
        )}

        {!playlist.isSystem && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={onRenamePlaylist}
              title="แก้ไขชื่อเพลย์ลิสต์"
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-[#A7A7A7] hover:text-white transition"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              title="ลบเพลย์ลิสต์"
              className="w-10 h-10 rounded-full hover:bg-red-500/15 flex items-center justify-center text-[#A7A7A7] hover:text-red-400 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Tracks Table */}
      <div className="relative z-10 rounded-2xl bg-[#181818]/75 border border-white/5 p-1.5 sm:p-3">
        {tracks.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-4">
            <p className="text-base font-semibold text-white">ยังไม่มีเพลงในเพลย์ลิสต์นี้</p>
            <p className="text-xs text-[#A7A7A7] max-w-md mx-auto">
              ไปที่แท็บ Google Drive เพื่อเลือกเพลงหรือโฟลเดอร์ที่คุณต้องการ แล้วกดปุ่ม + เพื่อจัดเข้าเพลย์ลิสต์นี้ได้ทันที
            </p>
            <button
              type="button"
              onClick={onNavigateToDrive}
              className="px-5 py-2.5 rounded-full bg-white text-black text-xs font-bold hover:bg-neutral-200 transition min-h-[44px]"
            >
              เลือกเพลงจาก Google Drive
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {tracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                isCurrent={currentTrackId === track.id}
                isPlaying={isPlaying}
                isOnline={isOnline}
                downloadProgress={downloads[track.id]}
                onPlay={() => onPlaySequential(trackIds, track.id)}
                onToggleLike={() => onToggleLike(track.id)}
                onToggleOffline={() => onToggleTrackOffline(track)}
                onAddToPlaylist={() => onAddToPlaylist(track)}
                onMoveUp={
                  !playlist.isSystem && idx > 0
                    ? () => onReorderTrack(playlist.id, idx, idx - 1)
                    : undefined
                }
                onMoveDown={
                  !playlist.isSystem && idx < tracks.length - 1
                    ? () => onReorderTrack(playlist.id, idx, idx + 1)
                    : undefined
                }
                onRemoveFromPlaylist={() =>
                  onRemoveTrackFromPlaylist(playlist.id, track.id)
                }
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="ลบเพลย์ลิสต์นี้?"
        message={`คุณต้องการลบเพลย์ลิสต์ "${playlist.name}" ใช่หรือไม่? (ไฟล์เพลงออฟไลน์ที่บันทึกไว้ในเครื่องจะยังคงอยู่)`}
        confirmLabel="ลบเพลย์ลิสต์"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => onDeletePlaylist(playlist.id)}
      />
    </div>
  );
};
