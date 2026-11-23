export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const totalSec = Math.floor(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export interface CoverPalette {
  from: string;
  to: string;
  accent: string;
  banner: string;
}

const PALETTES: CoverPalette[] = [
  { from: '#0f3d2e', to: '#081b15', accent: '#1ED760', banner: 'from-emerald-950' },
  { from: '#1e1b4b', to: '#09091a', accent: '#60a5fa', banner: 'from-indigo-950' },
  { from: '#4a1d42', to: '#180915', accent: '#f472b6', banner: 'from-fuchsia-950' },
  { from: '#5c2414', to: '#1c0b06', accent: '#fb923c', banner: 'from-orange-950' },
  { from: '#0c4a6e', to: '#061a29', accent: '#38bdf8', banner: 'from-sky-950' },
  { from: '#5c1428', to: '#1b060d', accent: '#fb7185', banner: 'from-rose-950' },
  { from: '#422d0b', to: '#171004', accent: '#fbbf24', banner: 'from-amber-950' },
  { from: '#1f2937', to: '#090d14', accent: '#34d399', banner: 'from-slate-900' },
];

export function getCoverPalette(seed: number): CoverPalette {
  const index = Math.abs(seed || 0) % PALETTES.length;
  return PALETTES[index];
}

const artworkCache = new Map<string, string>();

export function generateMediaArtworkDataUrl(title: string, seed: number): string {
  const key = `${seed}_${title.slice(0, 12)}`;
  const cached = artworkCache.get(key);
  if (cached) return cached;

  if (typeof document === 'undefined') return '/pwa-512x512.png';

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '/pwa-512x512.png';

  const palette = getCoverPalette(seed);
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, palette.from);
  grad.addColorStop(1, palette.to);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle concentric vinyl rings
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3;
  [120, 170, 220].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(256, 256, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Waveform accent bars
  ctx.fillStyle = palette.accent;
  const bars = [
    { x: 168, h: 64 },
    { x: 204, h: 120 },
    { x: 240, h: 168 },
    { x: 276, h: 110 },
    { x: 312, h: 56 },
  ];
  bars.forEach((b) => {
    const y = 256 - b.h / 2;
    ctx.beginPath();
    ctx.roundRect(b.x, y, 24, b.h, 12);
    ctx.fill();
  });

  const url = canvas.toDataURL('image/png');
  artworkCache.set(key, url);
  return url;
}
