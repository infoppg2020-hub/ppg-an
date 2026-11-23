import React from 'react';
import { HardDrive, Plus, Shuffle } from 'lucide-react';
import { Playlist, Track } from '../types/music';
import { formatBytes } from '../utils/formatters';
import { CoverArt } from './CoverArt';

interface LibraryViewProps {
  playlists: Playlist[];
  tracks: Track[];
  storageStats: { cachedBytes: number; cachedCount: number };
  onOpenPlaylist: (playlistId: string) => void;
  onCreatePlaylist: () => void;
  onShuffleOfflineAll: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  playlists,
  tracks,
  storageStats,
  onOpenPlaylist,
  onCreatePlaylist,
  onShuffleOfflineAll,
}) => {
  const offlineCount = tracks.filter((t) => t.isOfflineCached).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">คอลเลกชันออฟไลน์ของคุณ</h1>
          <p className="text-xs text-[#A7A7A7] mt-1">
            พร้อมฟังออฟไลน์ {offlineCount} เพลง · พื้นที่ใช้ไป{' '}
            <span className="font-mono tabular-nums">
              {formatBytes(storageStats.cachedBytes)}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onCreatePlaylist}
          className="w-11 h-11 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow"
          aria-label="สร้างเพลย์ลิสต์ใหม่"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {offlineCount > 0 && (
        <button
          type="button"
          onClick={onShuffleOfflineAll}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#1DB954]/15 border border-[#1DB954]/30 text-left min-h-[60px]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1DB954] text-black flex items-center justify-center">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">สุ่มเล่นเพลงออฟไลน์ทั้งหมด</p>
              <p className="text-xs text-[#D4D4D4] tabular-nums">
                {offlineCount} เพลงที่บันทึกไว้ในเครื่อง · ไม่ต้องใช้อินเทอร์เน็ต
              </p>
            </div>
          </div>
          <HardDrive className="w-5 h-5 text-[#1ED760]" />
        </button>
      )}

      <div className="space-y-2">
        {playlists.map((pl) => (
          <button
            key={pl.id}
            type="button"
            onClick={() => onOpenPlaylist(pl.id)}
            className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-[#181818] hover:bg-[#282828] text-left transition min-h-[68px]"
          >
            <CoverArt
              seed={pl.coverSeed}
              isLikedPlaylist={pl.id === 'liked'}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-white truncate">{pl.name}</p>
              <p className="text-xs text-[#A7A7A7] tabular-nums mt-0.5">
                เพลย์ลิสต์ · {pl.trackIds.length} เพลง
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
