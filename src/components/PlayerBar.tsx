import React, { useState } from 'react';
import {
  ChevronDown,
  Heart,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { RepeatMode, Track } from '../types/music';
import { getTrackAudioQuality } from '../utils/audioQuality';
import { formatDuration } from '../utils/formatters';
import { CoverArt } from './CoverArt';
import { HiResBadge } from './HiResBadge';

interface PlayerBarProps {
  currentTrack: Track | null;
  queue: string[];
  tracksById: Record<string, Track>;
  isPlaying: boolean;
  isBuffering: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  wakeLockSupported: boolean;
  wakeLockEnabled: boolean;
  eqActive: boolean;
  isStageOpen: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onChangeVolume: (val: number) => void;
  onToggleMute: () => void;
  onToggleLike: (trackId: string) => void;
  onToggleWakeLock: () => void;
  onPlayQueueTrack: (trackId: string) => void;
  onOpenEq: () => void;
  onOpenStage: () => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  currentTrack,
  queue,
  tracksById,
  isPlaying,
  isBuffering,
  isShuffle,
  repeatMode,
  currentTime,
  duration,
  volume,
  isMuted,
  wakeLockSupported,
  wakeLockEnabled,
  eqActive,
  isStageOpen,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onChangeVolume,
  onToggleMute,
  onToggleLike,
  onToggleWakeLock,
  onPlayQueueTrack,
  onOpenEq,
  onOpenStage,
}) => {
  const [expandedMobile, setExpandedMobile] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const currentQuality = getTrackAudioQuality(currentTrack);

  const effectiveDuration = duration || currentTrack?.duration || 0;
  const progressPercent =
    effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (effectiveDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * effectiveDuration);
  };

  return (
    <>
      {/* Mobile Compact Mini-Player (Height kept compact to stay within <=15% sticky cap with bottom nav) */}
      <div className="md:hidden bg-[#181818]/95 backdrop-blur-md border-t border-white/10 px-3 py-1.5 relative">
        <div
          className="absolute top-0 left-0 h-0.5 bg-[#1DB954] transition-all duration-150"
          style={{ width: `${progressPercent}%` }}
        />

        <div className="flex items-center justify-between gap-2 min-h-[44px]">
          <button
            type="button"
            onClick={() => {
              if (currentTrack) setExpandedMobile(true);
            }}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
          >
            <CoverArt
              seed={currentTrack?.coverSeed ?? 0}
              size="xs"
              isPlaying={isPlaying}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {currentTrack ? currentTrack.title : 'เลือกเพลงเพื่อเริ่มฟัง'}
                </p>
                {currentQuality.isHiRes && (
                  <HiResBadge size="xs" specLabel={currentQuality.specLabel} />
                )}
              </div>
              <p className="text-[11px] text-[#A7A7A7] truncate">
                {currentTrack
                  ? `${currentTrack.artist} · ${
                      currentTrack.isOfflineCached ? 'ออฟไลน์' : 'Drive'
                    }`
                  : 'Spotiflow Offline Player'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={onOpenEq}
              aria-label="Equalizer"
              className={`w-10 h-11 rounded-full flex items-center justify-center transition ${
                eqActive ? 'text-[#1ED760]' : 'text-[#A7A7A7]'
              }`}
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleShuffle}
              aria-label="สุ่มเพลง"
              className={`w-10 h-11 rounded-full flex items-center justify-center transition ${
                isShuffle ? 'text-[#1ED760]' : 'text-[#A7A7A7]'
              }`}
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={!currentTrack && queue.length === 0}
              aria-label={isPlaying ? 'หยุดชั่วคราว' : 'เล่นเพลง'}
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow disabled:opacity-40"
            >
              {isBuffering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Player Footer */}
      <footer className="hidden md:flex bg-black border-t border-white/10 px-4 h-[88px] items-center justify-between gap-4 z-30 shrink-0">
        {/* Left: Now Playing Info (click cover/title to open Full-Page Stage) */}
        <div className="flex items-center gap-3 w-1/3 min-w-0">
          <button
            type="button"
            onClick={onOpenStage}
            title="เปิดหน้าจอปกใหญ่ / แผ่นเสียง / เทป"
            className="flex items-center gap-3 min-w-0 flex-1 text-left group"
          >
            <CoverArt
              seed={currentTrack?.coverSeed ?? 0}
              size="md"
              isPlaying={isPlaying}
              className="group-hover:scale-105 transition-transform"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-sm font-semibold text-white truncate group-hover:text-[#1ED760] transition-colors">
                  {currentTrack ? currentTrack.title : 'เลือกเพลงเพื่อเริ่มฟัง'}
                </p>
                {currentQuality.isHiRes && (
                  <HiResBadge size="xs" specLabel={currentQuality.specLabel} />
                )}
              </div>
              <p className="text-xs text-[#A7A7A7] truncate">
                {currentTrack
                  ? `${currentTrack.artist} · ${
                      currentTrack.isOfflineCached ? 'พร้อมฟังออฟไลน์' : 'สตรีมจาก Drive'
                    }`
                  : 'คลิกเพื่อเปิดหน้าปกใหญ่ / แผ่นเสียง / เทป'}
              </p>
            </div>
          </button>
          {currentTrack && (
            <button
              type="button"
              onClick={() => onToggleLike(currentTrack.id)}
              title={currentTrack.liked ? 'นำออกจากเพลงที่ถูกใจ' : 'ถูกใจเพลงนี้'}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition shrink-0 ${
                currentTrack.liked
                  ? 'text-[#1ED760]'
                  : 'text-[#A7A7A7] hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${currentTrack.liked ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>

        {/* Center: Playback Controls & Scrubber */}
        <div className="flex flex-col items-center max-w-xl w-1/3 gap-1.5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onToggleShuffle}
              title="สุ่มเพลงในเพลย์ลิสต์"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                isShuffle
                  ? 'text-[#1ED760] bg-[#1DB954]/10'
                  : 'text-[#A7A7A7] hover:text-white'
              }`}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onPrev}
              title="เพลงก่อนหน้า"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#A7A7A7] hover:text-white transition"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              title={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
              className="w-10 h-10 rounded-full bg-white hover:scale-105 text-black flex items-center justify-center shadow transition"
            >
              {isBuffering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              title="เพลงถัดไป"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#A7A7A7] hover:text-white transition"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={onCycleRepeat}
              title={
                repeatMode === 'one'
                  ? 'เล่นซ้ำเพลงนี้'
                  : repeatMode === 'all'
                  ? 'เล่นซ้ำทั้งเพลย์ลิสต์'
                  : 'ปิดการเล่นซ้ำ'
              }
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                repeatMode !== 'off'
                  ? 'text-[#1ED760] bg-[#1DB954]/10'
                  : 'text-[#A7A7A7] hover:text-white'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="w-full flex items-center gap-2.5 text-[11px] font-mono tabular-nums text-[#A7A7A7]">
            <span className="w-10 text-right">{formatDuration(currentTime)}</span>
            <div
              onClick={handleScrub}
              className="flex-1 h-1.5 bg-[#3E3E3E] rounded-full cursor-pointer group relative flex items-center"
            >
              <div
                className="h-full bg-white group-hover:bg-[#1DB954] rounded-full relative transition-colors"
                style={{ width: `${progressPercent}%` }}
              >
                <span className="hidden group-hover:block w-3 h-3 bg-white rounded-full absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 shadow" />
              </div>
            </div>
            <span className="w-10">{formatDuration(effectiveDuration)}</span>
          </div>
        </div>

        {/* Right: Stage, EQ, Wake Lock, Queue, Volume */}
        <div className="flex items-center justify-end gap-1.5 w-1/3">
          <button
            type="button"
            onClick={onOpenStage}
            title="หน้าปกใหญ่ / แผ่นเสียง / เทป"
            className={`px-2.5 h-8 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold transition ${
              isStageOpen
                ? 'bg-[#1DB954] text-black'
                : 'bg-white/10 hover:bg-white/20 text-[#D4D4D4] hover:text-white'
            }`}
          >
            <span>Stage</span>
          </button>

          <button
            type="button"
            onClick={onOpenEq}
            title="ปรับแต่งเสียง Equalizer (EQ)"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
              eqActive
                ? 'text-[#1ED760] bg-[#1DB954]/10'
                : 'text-[#A7A7A7] hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
          </button>

          {wakeLockSupported && (
            <button
              type="button"
              onClick={onToggleWakeLock}
              title={
                wakeLockEnabled
                  ? 'เปิดโหมดหน้าจอสว่างค้างไว้ (คลิกเพื่อปิด)'
                  : 'เปิดหน้าจอสว่างค้างไว้ขณะเล่น'
              }
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                wakeLockEnabled
                  ? 'text-[#1ED760] bg-[#1DB954]/10'
                  : 'text-[#A7A7A7] hover:text-white'
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowQueue((prev) => !prev)}
            title="คิวเพลงปัจจุบัน"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
              showQueue ? 'text-[#1ED760] bg-[#1DB954]/10' : 'text-[#A7A7A7] hover:text-white'
            }`}
          >
            <ListMusic className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#A7A7A7] hover:text-white transition"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : Math.round(volume * 100)}
            onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
            aria-label="ระดับเสียง"
            className="w-24 h-1 bg-[#3E3E3E] rounded-lg appearance-none cursor-pointer accent-[#1DB954]"
          />
        </div>
      </footer>

      {/* Mobile Full-Screen Now Playing Sheet */}
      {expandedMobile && currentTrack && (
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#1a221d] via-[#121212] to-black flex flex-col p-5 md:hidden overflow-y-auto">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setExpandedMobile(false)}
              className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center text-white"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
            <span className="text-xs font-semibold text-[#D4D4D4]">
              {currentTrack.isOfflineCached ? 'เล่นจากไฟล์ออฟไลน์ในเครื่อง' : 'เล่นจาก Google Drive'}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setExpandedMobile(false);
                  onOpenStage();
                }}
                className="px-3 h-9 rounded-full bg-[#1DB954] text-black text-xs font-bold"
              >
                แผ่นเสียง/เทป
              </button>
              <button
                type="button"
                onClick={() => setShowQueue(true)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white"
              >
                <ListMusic className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-6 gap-6">
            <CoverArt
              seed={currentTrack.coverSeed}
              size="xl"
              className="shadow-2xl"
            />

            <div className="w-full max-w-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-xl font-bold text-white truncate">
                    {currentTrack.title}
                  </h2>
                  {currentQuality.isHiRes && (
                    <HiResBadge size="sm" specLabel={currentQuality.specLabel} />
                  )}
                </div>
                <p className="text-sm text-[#A7A7A7] truncate mt-0.5">
                  {currentTrack.artist}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleLike(currentTrack.id)}
                className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                  currentTrack.liked ? 'text-[#1ED760]' : 'text-[#A7A7A7]'
                }`}
              >
                <Heart
                  className={`w-6 h-6 ${currentTrack.liked ? 'fill-current' : ''}`}
                />
              </button>
            </div>

            {/* Scrubber */}
            <div className="w-full max-w-sm space-y-2">
              <div
                onClick={handleScrub}
                className="w-full h-2 bg-[#3E3E3E] rounded-full cursor-pointer relative"
              >
                <div
                  className="h-full bg-[#1DB954] rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs font-mono tabular-nums text-[#A7A7A7]">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(effectiveDuration)}</span>
              </div>
            </div>

            {/* Main Touch Controls */}
            <div className="w-full max-w-sm flex items-center justify-between">
              <button
                type="button"
                onClick={onToggleShuffle}
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isShuffle ? 'text-[#1ED760]' : 'text-[#A7A7A7]'
                }`}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={onPrev}
                className="w-12 h-12 rounded-full flex items-center justify-center text-white"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                className="w-16 h-16 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-xl"
              >
                {isBuffering ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-1" />
                )}
              </button>

              <button
                type="button"
                onClick={onNext}
                className="w-12 h-12 rounded-full flex items-center justify-center text-white"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </button>

              <button
                type="button"
                onClick={onCycleRepeat}
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  repeatMode !== 'off' ? 'text-[#1ED760]' : 'text-[#A7A7A7]'
                }`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
              </button>
            </div>

            {wakeLockSupported && (
              <button
                type="button"
                onClick={onToggleWakeLock}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border transition ${
                  wakeLockEnabled
                    ? 'bg-[#1DB954]/15 border-[#1DB954]/40 text-[#1ED760]'
                    : 'bg-white/5 border-white/10 text-[#A7A7A7]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>
                  {wakeLockEnabled
                    ? 'เปิดหน้าจอค้างไว้อยู่ (แตะเพื่อปิด)'
                    : 'ให้หน้าจอสว่างค้างไว้'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Queue Drawer Modal */}
      {showQueue && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-[#181818] border-l border-white/10 h-full flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">คิวเพลงถัดไป</h3>
                <p className="text-xs text-[#A7A7A7]">
                  {isShuffle ? 'กำลังเล่นแบบสุ่ม' : 'เล่นตามลำดับ'} ·{' '}
                  <span className="font-mono tabular-nums">{queue.length}</span> เพลง
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQueue(false)}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-[#A7A7A7] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {queue.length === 0 ? (
                <p className="text-sm text-[#A7A7A7] text-center py-12">
                  ยังไม่มีเพลงในคิว
                </p>
              ) : (
                queue.map((id, idx) => {
                  const t = tracksById[id];
                  if (!t) return null;
                  const active = currentTrack?.id === id;
                  const qInfo = getTrackAudioQuality(t);
                  return (
                    <button
                      key={`${id}_${idx}`}
                      type="button"
                      onClick={() => onPlayQueueTrack(id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition min-h-[56px] ${
                        active ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="w-5 text-xs font-mono tabular-nums text-[#A7A7A7] text-center">
                        {idx + 1}
                      </span>
                      <CoverArt
                        seed={t.coverSeed}
                        size="xs"
                        isPlaying={active && isPlaying}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p
                            className={`text-sm font-semibold truncate ${
                              active ? 'text-[#1ED760]' : 'text-white'
                            }`}
                          >
                            {t.title}
                          </p>
                          {qInfo.isHiRes && (
                            <HiResBadge size="xs" specLabel={qInfo.specLabel} />
                          )}
                        </div>
                        <p className="text-xs text-[#A7A7A7] truncate">
                          {t.artist} · {t.isOfflineCached ? 'ออฟไลน์' : 'Drive'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
