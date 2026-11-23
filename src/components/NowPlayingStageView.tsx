import React, { useState } from 'react';
import {
  ArrowLeft,
  CassetteTape,
  Disc3,
  Heart,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
} from 'lucide-react';
import { EqState, RepeatMode, Track } from '../types/music';
import { getTrackAudioQuality } from '../utils/audioQuality';
import { formatDuration, getCoverPalette } from '../utils/formatters';
import { CoverArt } from './CoverArt';
import { HiResBadge } from './HiResBadge';

type StageVisualMode = 'cover' | 'turntable' | 'cassette';

interface NowPlayingStageViewProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  currentTime: number;
  duration: number;
  eqState: EqState;
  onBack: () => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleLike: (trackId: string) => void;
  onOpenEq: () => void;
}

export const NowPlayingStageView: React.FC<NowPlayingStageViewProps> = ({
  currentTrack,
  isPlaying,
  isBuffering,
  isShuffle,
  repeatMode,
  currentTime,
  duration,
  eqState,
  onBack,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onToggleLike,
  onOpenEq,
}) => {
  const [visualMode, setVisualMode] = useState<StageVisualMode>('cover');

  const effectiveDuration = duration || currentTrack?.duration || 0;
  const progress =
    effectiveDuration > 0
      ? Math.max(0, Math.min(1, currentTime / effectiveDuration))
      : 0;

  const palette = getCoverPalette(currentTrack?.coverSeed ?? 0);
  const quality = getTrackAudioQuality(currentTrack);

  // Turntable tonearm math:
  // Pivot: (355, 68), Platter center: (175, 190), Arm length: 205
  // progress = 0 => innermost groove (~130.4 deg, r ≈ 58 from platter center)
  // progress = 1 => outermost groove (~107.0 deg, r ≈ 141 from platter center)
  const tonearmAngleDeg = 130.4 - progress * 23.4;

  // Cassette spool radius math:
  // Supply (left) shrinks 43 -> 19; Take-up (right) grows 19 -> 43
  const leftSpoolRadius = 43 - progress * 24;
  const rightSpoolRadius = 19 + progress * 24;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (effectiveDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * effectiveDuration);
  };

  return (
    <div className="relative min-h-[calc(100vh-14rem)] rounded-2xl overflow-hidden flex flex-col justify-between p-4 sm:p-8 bg-[#0b0d0e] border border-white/5">
      {/* Ambient Backdrop Gradient */}
      <div
        className="absolute inset-0 opacity-45 pointer-events-none transition-colors duration-500"
        style={{
          background: `radial-gradient(circle at 50% 28%, ${palette.from} 0%, #0b0d0e 72%)`,
        }}
      />

      {/* Top Stage Header & Visual Switcher */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition min-h-[40px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับหน้ารวม</span>
        </button>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/50 border border-white/10">
          <button
            type="button"
            onClick={() => setVisualMode('cover')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              visualMode === 'cover'
                ? 'bg-[#1DB954] text-black'
                : 'text-[#D4D4D4] hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>ปกใหญ่</span>
          </button>

          <button
            type="button"
            onClick={() => setVisualMode('turntable')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              visualMode === 'turntable'
                ? 'bg-[#1DB954] text-black'
                : 'text-[#D4D4D4] hover:text-white'
            }`}
          >
            <Disc3 className="w-3.5 h-3.5" />
            <span>แผ่นเสียง</span>
          </button>

          <button
            type="button"
            onClick={() => setVisualMode('cassette')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              visualMode === 'cassette'
                ? 'bg-[#1DB954] text-black'
                : 'text-[#D4D4D4] hover:text-white'
            }`}
          >
            <CassetteTape className="w-3.5 h-3.5" />
            <span>เทปคลาสสิค</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenEq}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition min-h-[40px] ${
            eqState.enabled && eqState.preset !== 'flat'
              ? 'bg-[#1DB954]/20 border-[#1DB954]/40 text-[#1ED760]'
              : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>EQ</span>
        </button>
      </div>

      {/* Center Visual Showcase */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-6 sm:py-8 gap-6">
        {visualMode === 'cover' && (
          <div className="flex flex-col items-center gap-5 w-full max-w-lg">
            <div className="relative">
              <div
                className="absolute -inset-6 rounded-3xl blur-2xl opacity-45 transition-opacity duration-500"
                style={{
                  background: palette.accent,
                  opacity: isPlaying ? 0.28 : 0.12,
                }}
              />
              <CoverArt
                seed={currentTrack?.coverSeed ?? 0}
                size="xl"
                className="!w-72 !h-72 sm:!w-96 sm:!h-96 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/15"
              />
              {quality.isHiRes && (
                <div className="absolute bottom-3.5 right-3.5 z-30">
                  <HiResBadge size="md" specLabel={quality.specLabel} />
                </div>
              )}
            </div>
          </div>
        )}

        {visualMode === 'turntable' && (
          <div className="w-full max-w-[540px] flex flex-col items-center gap-3">
            <div className="w-full rounded-3xl bg-gradient-to-br from-[#232629] to-[#111315] border border-white/10 p-3 sm:p-5 shadow-2xl">
              <svg
                viewBox="0 0 430 350"
                className="w-full h-auto select-none overflow-visible"
                role="img"
                aria-label="เครื่องเล่นแผ่นเสียง Turntable"
              >
                <defs>
                  <radialGradient id="vinylGrooves" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#141414" />
                    <stop offset="40%" stopColor="#090909" />
                    <stop offset="70%" stopColor="#161616" />
                    <stop offset="100%" stopColor="#070707" />
                  </radialGradient>
                  <linearGradient id="armMetal" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f3f4f6" />
                    <stop offset="50%" stopColor="#9ca3af" />
                    <stop offset="100%" stopColor="#d1d5db" />
                  </linearGradient>
                </defs>

                {/* Platter Base Ring */}
                <circle
                  cx="175"
                  cy="190"
                  r="148"
                  fill="#0b0c0d"
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="3"
                />
                <circle
                  cx="175"
                  cy="190"
                  r="145"
                  fill="none"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="2"
                  strokeDasharray="2 5"
                />

                {/* Spinning Vinyl Group */}
                <g
                  className="animate-vinyl-spin"
                  style={{
                    transformOrigin: '175px 190px',
                    animationPlayState: isPlaying ? 'running' : 'paused',
                  }}
                >
                  <circle cx="175" cy="190" r="140" fill="url(#vinylGrooves)" />

                  {/* Concentric Microgrooves */}
                  {[62, 74, 86, 98, 110, 122, 134].map((r) => (
                    <circle
                      key={r}
                      cx="175"
                      cy="190"
                      r={r}
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="0.9"
                    />
                  ))}

                  {/* Specular Vinyl Reflection Wedges */}
                  <path
                    d="M 175 190 L 72 95 A 138 138 0 0 1 135 58 Z"
                    fill="rgba(255,255,255,0.06)"
                  />
                  <path
                    d="M 175 190 L 278 285 A 138 138 0 0 1 215 322 Z"
                    fill="rgba(255,255,255,0.05)"
                  />

                  {/* Center Record Label */}
                  <circle cx="175" cy="190" r="46" fill={palette.from} />
                  <circle
                    cx="175"
                    cy="190"
                    r="42"
                    fill="none"
                    stroke={palette.accent}
                    strokeOpacity="0.6"
                    strokeWidth="1.5"
                  />
                  <text
                    x="175"
                    y="175"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="8"
                    fontWeight="700"
                  >
                    SPOTIFLOW
                  </text>
                  {quality.isHiRes && (
                    <g>
                      <rect
                        x="151"
                        y="196"
                        width="48"
                        height="12"
                        rx="2"
                        fill="#141106"
                        stroke="#F5CB49"
                        strokeWidth="0.9"
                      />
                      <text
                        x="175"
                        y="204.5"
                        textAnchor="middle"
                        fill="#F5CB49"
                        fontSize="6.5"
                        fontWeight="800"
                        letterSpacing="0.8"
                      >
                        HI-RES
                      </text>
                    </g>
                  )}
                  <text
                    x="175"
                    y={quality.isHiRes ? '218' : '211'}
                    textAnchor="middle"
                    fill={palette.accent}
                    fontSize="7"
                    fontWeight="600"
                  >
                    33⅓ RPM
                  </text>
                  {/* Center Spindle */}
                  <circle cx="175" cy="190" r="5" fill="#e5e7eb" />
                  <circle cx="175" cy="190" r="2" fill="#111827" />
                </g>

                {/* Deck Status Controls on Bottom Right */}
                {quality.isHiRes && (
                  <g>
                    <rect
                      x="338"
                      y="246"
                      width="64"
                      height="20"
                      rx="4"
                      fill="#141106"
                      stroke="#E5B83B"
                      strokeWidth="1"
                    />
                    <text
                      x="370"
                      y="259"
                      textAnchor="middle"
                      fill="#F5CB49"
                      fontSize="8"
                      fontWeight="800"
                      letterSpacing="0.8"
                    >
                      HI-RES
                    </text>
                  </g>
                )}
                <rect
                  x="338"
                  y="274"
                  width="64"
                  height="42"
                  rx="8"
                  fill="#181a1d"
                  stroke="rgba(255,255,255,0.08)"
                />
                <circle
                  cx="355"
                  cy="295"
                  r="6"
                  fill={isPlaying ? '#1ED760' : '#4b5563'}
                />
                <text
                  x="384"
                  y="298"
                  textAnchor="middle"
                  fill="#d1d5db"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {isPlaying ? 'SPIN' : 'HOLD'}
                </text>

                {/* Tonearm Assembly (Pivot at 355, 68 — moves from inner groove at 0% to outer edge at 100%) */}
                <g>
                  {/* Tonearm Gimbal Base */}
                  <circle
                    cx="355"
                    cy="68"
                    r="26"
                    fill="#1a1d21"
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth="2"
                  />
                  <circle cx="355" cy="68" r="16" fill="#2c3038" />

                  <g
                    transform={`translate(0 ${isPlaying ? 0 : -2}) rotate(${tonearmAngleDeg} 355 68)`}
                    style={{
                      transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    {/* Counterweight behind pivot */}
                    <rect
                      x="-32"
                      y="-9"
                      width="22"
                      height="18"
                      rx="4"
                      transform="translate(355 68)"
                      fill="#4b5563"
                      stroke="#9ca3af"
                      strokeWidth="1"
                    />
                    {/* Tonearm Tube along local +X axis from pivot (0..186) */}
                    <line
                      x1="345"
                      y1="68"
                      x2="540"
                      y2="68"
                      stroke="url(#armMetal)"
                      strokeWidth="5.5"
                      strokeLinecap="round"
                    />
                    {/* Headshell & Cartridge */}
                    <g transform="translate(536, 68) rotate(16)">
                      <rect
                        x="0"
                        y="-6"
                        width="24"
                        height="12"
                        rx="2.5"
                        fill="#111827"
                        stroke="#9ca3af"
                        strokeWidth="1.2"
                      />
                      {/* Stylus Needle Tip */}
                      <circle
                        cx="22"
                        cy="0"
                        r="3"
                        fill={isPlaying ? '#1ED760' : '#f3f4f6'}
                      />
                    </g>
                  </g>
                </g>
              </svg>
            </div>

            <p className="text-xs text-[#A7A7A7] font-mono tabular-nums">
              ตำแหน่งเข็ม (ในสุด → นอกสุด): {Math.round(progress * 100)}%
            </p>
          </div>
        )}

        {visualMode === 'cassette' && (
          <div className="w-full max-w-[540px] flex flex-col items-center gap-3">
            <div className="w-full rounded-3xl bg-gradient-to-b from-[#232528] to-[#121315] border border-white/10 p-4 sm:p-6 shadow-2xl">
              <svg
                viewBox="0 0 460 290"
                className="w-full h-auto select-none"
                role="img"
                aria-label="เทปคาสเซ็ทคลาสสิค"
              >
                <defs>
                  <linearGradient id="cassetteBody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#27272a" />
                    <stop offset="100%" stopColor="#141417" />
                  </linearGradient>
                  <linearGradient id="cassetteLabel" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f4efe6" />
                    <stop offset="100%" stopColor="#e7dfd1" />
                  </linearGradient>
                </defs>

                {/* Outer Cassette Housing */}
                <rect
                  x="15"
                  y="15"
                  width="430"
                  height="260"
                  rx="18"
                  fill="url(#cassetteBody)"
                  stroke="rgba(255,255,255,0.16)"
                  strokeWidth="2"
                />

                {/* Corner Screws */}
                {[
                  [32, 32],
                  [428, 32],
                  [32, 258],
                  [428, 258],
                ].map(([cx, cy]) => (
                  <g key={`${cx}_${cy}`}>
                    <circle cx={cx} cy={cy} r="5.5" fill="#3f3f46" />
                    <line
                      x1={cx - 3}
                      y1={cy}
                      x2={cx + 3}
                      y2={cy}
                      stroke="#18181b"
                      strokeWidth="1.2"
                    />
                  </g>
                ))}

                {/* Retro Paper Label */}
                <rect
                  x="42"
                  y="32"
                  width="376"
                  height="168"
                  rx="10"
                  fill="url(#cassetteLabel)"
                />
                {/* Accent Stripe on Label */}
                <rect x="42" y="76" width="376" height="10" fill={palette.accent} />
                <rect x="42" y="86" width="376" height="4" fill={palette.from} />

                <text
                  x="58"
                  y="54"
                  fill="#18181b"
                  fontSize="13"
                  fontWeight="700"
                >
                  {(currentTrack?.title || 'เลือกเพลงเพื่อเล่น').slice(0, 34)}
                </text>
                <text
                  x="58"
                  y="70"
                  fill="#52525b"
                  fontSize="10"
                  fontWeight="500"
                >
                  {(currentTrack?.artist || 'Spotiflow Classic Tape').slice(0, 38)}
                </text>
                <text
                  x="402"
                  y="56"
                  textAnchor="end"
                  fill="#18181b"
                  fontSize="11"
                  fontWeight="800"
                  fontFamily="monospace"
                >
                  SIDE A
                </text>
                {quality.isHiRes ? (
                  <g>
                    <rect
                      x="328"
                      y="60"
                      width="74"
                      height="13"
                      rx="2"
                      fill="#141106"
                      stroke="#D4AF37"
                      strokeWidth="0.9"
                    />
                    <text
                      x="365"
                      y="69"
                      textAnchor="middle"
                      fill="#F5CB49"
                      fontSize="7"
                      fontWeight="800"
                      letterSpacing="0.7"
                    >
                      HI-RES AUDIO
                    </text>
                  </g>
                ) : (
                  <text
                    x="402"
                    y="70"
                    textAnchor="end"
                    fill="#52525b"
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    C-90 OFFLINE
                  </text>
                )}

                {/* Smoked Transparent Center Window */}
                <rect
                  x="76"
                  y="102"
                  width="308"
                  height="84"
                  rx="12"
                  fill="#111214"
                  stroke="#27272a"
                  strokeWidth="2"
                />

                {/* Left Magnetic Tape Spool (Shrinks as song plays) */}
                <circle
                  cx="148"
                  cy="144"
                  r={leftSpoolRadius}
                  fill="#3d261a"
                  stroke="#573828"
                  strokeWidth="1.5"
                />
                {/* Right Magnetic Tape Spool (Grows as song plays) */}
                <circle
                  cx="312"
                  cy="144"
                  r={rightSpoolRadius}
                  fill="#3d261a"
                  stroke="#573828"
                  strokeWidth="1.5"
                />

                {/* Animated Moving Tape Ribbon Path */}
                <path
                  d={`M ${148 - leftSpoolRadius} 144 L 96 168 L 116 182 L 344 182 L 364 168 L ${
                    312 + rightSpoolRadius
                  } 144`}
                  fill="none"
                  stroke="#3b2316"
                  strokeWidth="4.5"
                  strokeLinejoin="round"
                />
                <path
                  d={`M ${148 - leftSpoolRadius} 144 L 96 168 L 116 182 L 344 182 L 364 168 L ${
                    312 + rightSpoolRadius
                  } 144`}
                  fill="none"
                  stroke={palette.accent}
                  strokeOpacity="0.65"
                  strokeWidth="1.8"
                  strokeDasharray="6 10"
                  className={isPlaying ? 'animate-tape-ribbon' : ''}
                />

                {/* Left & Right Guide Rollers */}
                <circle cx="98" cy="168" r="5" fill="#d4d4d8" />
                <circle cx="362" cy="168" r="5" fill="#d4d4d8" />

                {/* Left Rotating Hub */}
                <g
                  className="animate-reel-spin"
                  style={{
                    transformOrigin: '148px 144px',
                    animationPlayState: isPlaying ? 'running' : 'paused',
                  }}
                >
                  <circle
                    cx="148"
                    cy="144"
                    r="17"
                    fill="#f4f4f5"
                    stroke="#a1a1aa"
                    strokeWidth="1.5"
                  />
                  <circle cx="148" cy="144" r="9" fill="#18181b" />
                  {[0, 60, 120, 180, 240, 300].map((deg) => (
                    <rect
                      key={deg}
                      x="146.5"
                      y="130"
                      width="3"
                      height="6"
                      rx="1"
                      fill="#18181b"
                      transform={`rotate(${deg} 148 144)`}
                    />
                  ))}
                </g>

                {/* Right Rotating Hub */}
                <g
                  className="animate-reel-spin"
                  style={{
                    transformOrigin: '312px 144px',
                    animationPlayState: isPlaying ? 'running' : 'paused',
                  }}
                >
                  <circle
                    cx="312"
                    cy="144"
                    r="17"
                    fill="#f4f4f5"
                    stroke="#a1a1aa"
                    strokeWidth="1.5"
                  />
                  <circle cx="312" cy="144" r="9" fill="#18181b" />
                  {[0, 60, 120, 180, 240, 300].map((deg) => (
                    <rect
                      key={deg}
                      x="310.5"
                      y="130"
                      width="3"
                      height="6"
                      rx="1"
                      fill="#18181b"
                      transform={`rotate(${deg} 312 144)`}
                    />
                  ))}
                </g>

                {/* Tape Counter Window */}
                <rect
                  x="198"
                  y="132"
                  width="64"
                  height="24"
                  rx="4"
                  fill="#09090b"
                  stroke="rgba(255,255,255,0.12)"
                />
                <text
                  x="230"
                  y="148"
                  textAnchor="middle"
                  fill="#1ED760"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {formatDuration(currentTime)}
                </text>

                {/* Bottom Trapezoidal Cassette Bridge */}
                <path
                  d="M 110 275 L 128 218 L 332 218 L 350 275 Z"
                  fill="#1c1c20"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1.5"
                />
                {/* Magnetic Head Pad */}
                <rect
                  x="210"
                  y="222"
                  width="40"
                  height="10"
                  rx="2"
                  fill={isPlaying ? '#1ED760' : '#52525b'}
                />
                <circle cx="164" cy="248" r="8" fill="#09090b" />
                <circle cx="296" cy="248" r="8" fill="#09090b" />
                <circle cx="194" cy="252" r="5" fill="#09090b" />
                <circle cx="266" cy="252" r="5" fill="#09090b" />
              </svg>
            </div>

            <p className="text-xs text-[#A7A7A7] font-mono tabular-nums">
              เส้นเทปกำลังหมุน {isPlaying ? '· กำลังเล่น' : '· หยุดชั่วคราว'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Song Info & Full Transport Controls */}
      <div className="relative z-10 max-w-2xl w-full mx-auto space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-white truncate">
                {currentTrack ? currentTrack.title : 'เลือกเพลงเพื่อเริ่มฟัง'}
              </h2>
              {quality.isHiRes && (
                <HiResBadge size="sm" specLabel={quality.specLabel} />
              )}
            </div>
            <p className="text-sm text-[#A7A7A7] truncate">
              {currentTrack
                ? `${currentTrack.artist} · ${
                    currentTrack.isOfflineCached ? 'พร้อมฟังออฟไลน์' : 'สตรีมจาก Drive'
                  }${quality.specLabel ? ` · ${quality.specLabel}` : ''}`
                : 'Spotiflow Visual Stage'}
            </p>
          </div>
          {currentTrack && (
            <button
              type="button"
              onClick={() => onToggleLike(currentTrack.id)}
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition ${
                currentTrack.liked
                  ? 'text-[#1ED760] bg-[#1DB954]/10'
                  : 'text-[#A7A7A7] hover:text-white hover:bg-white/10'
              }`}
            >
              <Heart className={`w-5 h-5 ${currentTrack.liked ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>

        {/* Progress Scrubber */}
        <div className="space-y-1.5">
          <div
            onClick={handleScrub}
            className="w-full h-2 bg-white/15 rounded-full cursor-pointer group relative"
          >
            <div
              className="h-full bg-[#1DB954] rounded-full relative"
              style={{ width: `${progress * 100}%` }}
            >
              <span className="w-3.5 h-3.5 bg-white rounded-full absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 shadow" />
            </div>
          </div>
          <div className="flex justify-between text-xs font-mono tabular-nums text-[#A7A7A7]">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(effectiveDuration)}</span>
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={onToggleShuffle}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
              isShuffle ? 'text-[#1ED760] bg-[#1DB954]/15' : 'text-[#A7A7A7] hover:text-white'
            }`}
            title="สุ่มเพลง"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onPrev}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition"
            title="เพลงก่อนหน้า"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            className="w-14 h-14 rounded-full bg-[#1DB954] hover:bg-[#1ED760] text-black flex items-center justify-center shadow-xl transition"
            title={isPlaying ? 'หยุดชั่วคราว' : 'เล่นเพลง'}
          >
            {isBuffering ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition"
            title="เพลงถัดไป"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          <button
            type="button"
            onClick={onCycleRepeat}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
              repeatMode !== 'off'
                ? 'text-[#1ED760] bg-[#1DB954]/15'
                : 'text-[#A7A7A7] hover:text-white'
            }`}
            title="เล่นซ้ำ"
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
