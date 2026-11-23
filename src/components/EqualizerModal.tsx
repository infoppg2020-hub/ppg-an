import React, { useEffect, useRef } from 'react';
import { RotateCcw, Sliders, X } from 'lucide-react';
import { EqPresetId, EqState } from '../types/music';
import { EQ_BANDS, EQ_PRESETS } from '../utils/eqPresets';

interface EqualizerModalProps {
  isOpen: boolean;
  isPlaying: boolean;
  eqState: EqState;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  onClose: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onChangeBand: (bandIndex: number, gainDb: number) => void;
  onSelectPreset: (presetId: Exclude<EqPresetId, 'custom'>) => void;
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({
  isOpen,
  isPlaying,
  eqState,
  analyserRef,
  onClose,
  onToggleEnabled,
  onChangeBand,
  onSelectPreset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Real-time lightweight spectrum meter
  useEffect(() => {
    if (!isOpen) return;
    let rafId = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          const analyser = analyserRef.current;
          const barCount = 24;
          const barW = (w - (barCount - 1) * 4) / barCount;

          if (analyser && isPlaying) {
            const bins = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(bins);
            for (let i = 0; i < barCount; i++) {
              const binIdx = Math.min(
                bins.length - 1,
                Math.floor((i / barCount) * bins.length)
              );
              const val = bins[binIdx] / 255;
              const barH = Math.max(4, val * (h - 6));
              ctx.fillStyle = eqState.enabled ? '#1ED760' : '#737373';
              ctx.beginPath();
              ctx.roundRect(i * (barW + 4), h - barH, barW, barH, 3);
              ctx.fill();
            }
          } else {
            for (let i = 0; i < barCount; i++) {
              ctx.fillStyle = 'rgba(255,255,255,0.12)';
              ctx.beginPath();
              ctx.roundRect(i * (barW + 4), h - 4, barW, 4, 2);
              ctx.fill();
            }
          }
        }
      }
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [analyserRef, eqState.enabled, isOpen, isPlaying]);

  if (!isOpen) return null;

  // Build smooth SVG curve path across the 6 bands
  const svgPoints = eqState.bands.map((db, idx) => {
    const x = 30 + idx * 68;
    const y = 55 - ((eqState.enabled ? db : 0) / 12) * 40;
    return { x, y };
  });
  const pathD = svgPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-[#181818] border border-white/10 p-5 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1DB954]/15 text-[#1ED760] flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Equalizer (EQ)</h3>
              <p className="text-xs text-[#A7A7A7]">
                ปรับแต่งย่านความถี่เสียง 6 ย่านแบบเรียลไทม์
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleEnabled(!eqState.enabled)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition min-h-[36px] ${
                eqState.enabled
                  ? 'bg-[#1DB954] text-black'
                  : 'bg-white/10 text-[#A7A7A7] hover:text-white'
              }`}
            >
              {eqState.enabled ? 'เปิด EQ' : 'ปิด EQ'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-[#A7A7A7] hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Spectrum & EQ Curve */}
        <div className="rounded-xl bg-[#111111] border border-white/5 p-3 space-y-2">
          <canvas
            ref={canvasRef}
            width={440}
            height={54}
            className="w-full h-12 rounded-lg"
          />
          <svg
            viewBox="0 0 400 110"
            className="w-full h-20 overflow-visible"
            aria-hidden="true"
          >
            <line
              x1="10"
              y1="55"
              x2="390"
              y2="55"
              stroke="rgba(255,255,255,0.12)"
              strokeDasharray="4 4"
            />
            <path
              d={pathD}
              fill="none"
              stroke={eqState.enabled ? '#1ED760' : '#737373'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {svgPoints.map((p, i) => (
              <circle
                key={EQ_BANDS[i].label}
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill={eqState.enabled ? '#1ED760' : '#737373'}
                stroke="#111111"
                strokeWidth="2"
              />
            ))}
          </svg>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A7A7A7]">
              โปรไฟล์เสียงสำเร็จรูป (Presets)
            </span>
            <button
              type="button"
              onClick={() => onSelectPreset('flat')}
              className="inline-flex items-center gap-1 text-xs text-[#A7A7A7] hover:text-white transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>รีเซ็ต Flat</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {EQ_PRESETS.map((preset) => {
              const active = eqState.enabled && eqState.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition min-h-[36px] ${
                    active
                      ? 'bg-[#1DB954] text-black'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] text-[#D4D4D4]'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 6 Vertical Sliders */}
        <div className="grid grid-cols-6 gap-2 pt-1">
          {EQ_BANDS.map((band) => {
            const val = eqState.bands[band.index] ?? 0;
            return (
              <div
                key={band.label}
                className="flex flex-col items-center gap-2 bg-[#121212] border border-white/5 rounded-xl py-3 px-1"
              >
                <span
                  className={`text-[11px] font-mono tabular-nums font-semibold ${
                    !eqState.enabled
                      ? 'text-[#737373]'
                      : val > 0
                      ? 'text-[#1ED760]'
                      : val < 0
                      ? 'text-sky-400'
                      : 'text-[#D4D4D4]'
                  }`}
                >
                  {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
                </span>

                <div className="h-36 flex items-center justify-center">
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={val}
                    onChange={(e) =>
                      onChangeBand(band.index, Number(e.target.value))
                    }
                    aria-label={`${band.label} gain`}
                    className="w-32 h-1.5 -rotate-90 appearance-none bg-[#2E2E2E] rounded-full cursor-pointer accent-[#1DB954]"
                  />
                </div>

                <span className="text-[11px] font-mono text-[#A7A7A7]">
                  {band.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
