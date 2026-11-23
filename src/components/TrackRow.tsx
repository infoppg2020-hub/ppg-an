import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CloudOff,
  Download,
  Heart,
  ListPlus,
  Loader2,
  Trash2,
} from 'lucide-react';
import { DownloadProgress, Track } from '../types/music';
import { getTrackAudioQuality } from '../utils/audioQuality';
import { formatBytes, formatDuration } from '../utils/formatters';
import { CoverArt } from './CoverArt';
import { HiResBadge } from './HiResBadge';

interface TrackRowProps {
  track: Track;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isOnline: boolean;
  downloadProgress?: DownloadProgress;
  onPlay: () => void;
  onToggleLike: () => void;
  onToggleOffline: () => void;
  onAddToPlaylist: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemoveFromPlaylist?: () => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  isCurrent,
  isPlaying,
  isOnline,
  downloadProgress,
  onPlay,
  onToggleLike,
  onToggleOffline,
  onAddToPlaylist,
  onMoveUp,
  onMoveDown,
  onRemoveFromPlaylist,
}) => {
  const unavailableOffline = !isOnline && !track.isOfflineCached;
  const isDownloading = Boolean(downloadProgress);
  const quality = getTrackAudioQuality(track);

  return (
    <div
      onClick={() => {
        if (!unavailableOffline) onPlay();
      }}
      className={`group flex items-center justify-between gap-2 sm:gap-4 px-2.5 sm:px-3 py-2 rounded-xl transition min-h-[60px] ${
        unavailableOffline
          ? 'opacity-45 cursor-not-allowed'
          : 'hover:bg-white/10 active:bg-white/15 cursor-pointer'
      } ${isCurrent ? 'bg-white/[0.07]' : ''}`}
    >
      {/* Left: Index + Artwork + Title/Artist */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span
          className={`hidden sm:inline-flex w-6 justify-center text-xs font-mono tabular-nums shrink-0 ${
            isCurrent ? 'text-[#1ED760] font-semibold' : 'text-[#A7A7A7]'
          }`}
        >
          {index + 1}
        </span>

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
            {track.size > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums shrink-0">
                  {formatBytes(track.size)}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span
              className={`shrink-0 ${
                track.isOfflineCached ? 'text-[#1ED760]' : 'text-[#A7A7A7]'
              }`}
            >
              {track.isOfflineCached
                ? 'พร้อมฟังออฟไลน์'
                : unavailableOffline
                ? 'ต้องต่อเน็ต'
                : 'Google Drive'}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Functional Action Controls */}
      <div
        className="flex items-center gap-0.5 sm:gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {onMoveUp && (
          <button
            type="button"
            onClick={onMoveUp}
            title="เลื่อนขึ้น"
            className="hidden md:flex w-9 h-9 rounded-full items-center justify-center text-[#A7A7A7] hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}
        {onMoveDown && (
          <button
            type="button"
            onClick={onMoveDown}
            title="เลื่อนลง"
            className="hidden md:flex w-9 h-9 rounded-full items-center justify-center text-[#A7A7A7] hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleOffline}
          disabled={isDownloading || (!isOnline && !track.isOfflineCached)}
          title={
            track.isOfflineCached
              ? 'บันทึกออฟไลน์แล้ว (คลิกเพื่อลบไฟล์แคช)'
              : 'ดาวน์โหลดเก็บไว้ฟังออฟไลน์'
          }
          className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
            track.isOfflineCached
              ? 'text-[#1ED760] hover:bg-[#1DB954]/15'
              : unavailableOffline
              ? 'text-[#525252]'
              : 'text-[#A7A7A7] hover:text-white hover:bg-white/10'
          }`}
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#1ED760]" />
          ) : track.isOfflineCached ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : unavailableOffline ? (
            <CloudOff className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onAddToPlaylist}
          title="เพิ่มลงเพลย์ลิสต์"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#A7A7A7] hover:text-white hover:bg-white/10 transition"
        >
          <ListPlus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleLike}
          title={track.liked ? 'นำออกจากเพลงที่ถูกใจ' : 'ถูกใจเพลงนี้'}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
            track.liked
              ? 'text-[#1ED760]'
              : 'text-[#A7A7A7] hover:text-white hover:bg-white/10'
          }`}
        >
          <Heart className={`w-4 h-4 ${track.liked ? 'fill-current' : ''}`} />
        </button>

        {onRemoveFromPlaylist && (
          <button
            type="button"
            onClick={onRemoveFromPlaylist}
            title="นำออกจากเพลย์ลิสต์นี้"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#A7A7A7] hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        <span className="hidden sm:inline-block w-12 text-right text-xs font-mono tabular-nums text-[#A7A7A7]">
          {track.duration > 0 ? formatDuration(track.duration) : '--:--'}
        </span>
      </div>
    </div>
  );
};
