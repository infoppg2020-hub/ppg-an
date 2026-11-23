import { EqPresetId, EqState } from '../types/music';

export interface EqBandMeta {
  index: number;
  freq: number;
  label: string;
  type: BiquadFilterType;
}

export const EQ_BANDS: EqBandMeta[] = [
  { index: 0, freq: 60, label: '60Hz', type: 'lowshelf' },
  { index: 1, freq: 170, label: '170Hz', type: 'peaking' },
  { index: 2, freq: 400, label: '400Hz', type: 'peaking' },
  { index: 3, freq: 1000, label: '1kHz', type: 'peaking' },
  { index: 4, freq: 3500, label: '3.5kHz', type: 'peaking' },
  { index: 5, freq: 10000, label: '10kHz', type: 'highshelf' },
];

export interface EqPresetOption {
  id: Exclude<EqPresetId, 'custom'>;
  name: string;
  bands: [number, number, number, number, number, number];
}

export const EQ_PRESETS: EqPresetOption[] = [
  { id: 'flat', name: 'Flat (ปกติ)', bands: [0, 0, 0, 0, 0, 0] },
  { id: 'bass_boost', name: 'Bass Boost', bands: [7, 5, 1.5, 0, 1, 2] },
  { id: 'acoustic', name: 'Acoustic', bands: [3, 2, 1, 2, 3.5, 3] },
  { id: 'vocal', name: 'เน้นเสียงร้อง', bands: [-2, -1, 2, 5, 4, 1.5] },
  { id: 'lofi_warm', name: 'Lo-Fi เทปอุ่น', bands: [4, 3, 2, 0, -3, -5] },
  { id: 'electronic', name: 'Electronic', bands: [6, 4, 0, -1, 3, 5] },
  { id: 'rock', name: 'Rock', bands: [5, 3, -1, 2, 4, 5] },
];

const EQ_STORAGE_KEY = 'spotiflow_eq_preferences_v1';

export const DEFAULT_EQ_STATE: EqState = {
  enabled: true,
  preset: 'flat',
  bands: [0, 0, 0, 0, 0, 0],
};

export function loadSavedEqState(): EqState {
  try {
    const raw = localStorage.getItem(EQ_STORAGE_KEY);
    if (!raw) return DEFAULT_EQ_STATE;
    const parsed = JSON.parse(raw) as Partial<EqState>;
    if (!Array.isArray(parsed.bands) || parsed.bands.length !== 6) {
      return DEFAULT_EQ_STATE;
    }
    const clamped = parsed.bands.map((v) =>
      Math.max(-12, Math.min(12, Number(v) || 0))
    ) as [number, number, number, number, number, number];
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      preset: parsed.preset || 'flat',
      bands: clamped,
    };
  } catch {
    return DEFAULT_EQ_STATE;
  }
}

export function saveEqState(state: EqState): void {
  try {
    localStorage.setItem(EQ_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}
