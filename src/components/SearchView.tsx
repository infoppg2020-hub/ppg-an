import React, { useMemo, useState } from 'react';
import { Search, Shuffle } from 'lucide-react';
import { DownloadProgress, Playlist, Track } from '../types/music';
import { CoverArt } from './CoverArt';
import { TrackRow } from './TrackRow';

interface SearchViewProps {
  tracks: Track[];
  playlists: Playlist[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isOnline: boolean;
  downloads: Record<string, DownloadProgress>;
  onPlayTracks: (trackIds: string[], startTrackId?: string, shuffle?: boolean) => void;
  onOpenPlaylist: (playlistId: string) => void;
  onToggleLike: (trackId: string) => void;
  onToggleOffline: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  tracks,
  playlists,
  currentTrackId,
  isPlaying,
  isOnline,
  downloads,
  onPlayTracks,
  onOpenPlaylist,
  onToggleLike,
  onToggleOffline,
  onAddToPlaylist,
}) => {
  const [query, setQuery] = useState('');
  const [onlyOffline, setOnlyOffline] = useState(!isOnline);

  const filteredTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks.filter((t) => {
      if (onlyOffline && !t.isOfflineCached) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
      );
    });
  }, [onlyOffline, query, tracks]);

  const filteredPlaylists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter(
      (pl) =>
        pl.name.toLowerCase().includes(q) ||
        pl.description.toLowerCase().includes(q)
    );
  }, [playlists, query]);

  const filteredIds = filteredTracks.map((t) => t.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-[#A7A7A7] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาเพลง ศิลปิน หรือเพลย์ลิสต์ (ค้นหาได้แม้ออฟไลน์)..."
            className="w-full rounded-full bg-[#181818] border border-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#1DB954]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#181818] border border-white/10 self-start">
          <button
            type="button"
            onClick={() => setOnlyOffline(false)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
              !onlyOffline ? 'bg-[#282828] text-white' : 'text-[#A7A7A7] hover:text-white'
            }`}
          >
            ทุกเพลง ({tracks.length})
          </button>
          <button
            type="button"
            onClick={() => setOnlyOffline(true)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
              onlyOffline ? 'bg-[#282828] text-[#1ED760]' : 'text-[#A7A7A7] hover:text-white'
            }`}
          >
            เฉพาะออฟไลน์ ({tracks.filter((t) => t.isOfflineCached).length})
          </button>
        </div>
      </div>

      {filteredPlaylists.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">เพลย์ลิสต์</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredPlaylists.map((pl) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => onOpenPlaylist(pl.id)}
                className="rounded-xl bg-[#181818] hover:bg-[#282828] p-3.5 text-left transition space-y-3"
              >
                <CoverArt
                  seed={pl.coverSeed}
                  isLikedPlaylist={pl.id === 'liked'}
                  size="lg"
                  className="!w-full !h-auto aspect-square"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{pl.name}</p>
                  <p className="text-xs text-[#A7A7A7] tabular-nums mt-0.5">
                    {pl.trackIds.length} เพลง
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            เพลงที่พบ ({filteredTracks.length})
          </h2>
          {filteredIds.length > 0 && (
            <button
              type="button"
              onClick={() => onPlayTracks(filteredIds, undefined, true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1ED760] hover:underline"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>สุ่มเล่นผลลัพธ์</span>
            </button>
          )}
        </div>

        {filteredTracks.length === 0 ? (
          <div className="rounded-2xl bg-[#181818] border border-white/5 p-10 text-center text-sm text-[#A7A7A7]">
            ไม่พบเพลงที่ตรงกับคำค้นหาของคุณ
          </div>
        ) : (
          <div className="rounded-2xl bg-[#181818]/75 border border-white/5 p-1.5 sm:p-3 divide-y divide-white/[0.04]">
            {filteredTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                isCurrent={currentTrackId === track.id}
                isPlaying={isPlaying}
                isOnline={isOnline}
                downloadProgress={downloads[track.id]}
                onPlay={() => onPlayTracks(filteredIds, track.id, false)}
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
