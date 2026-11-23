export interface Track {
  id: string;
  driveFileId?: string;
  title: string;
  artist: string;
  album: string;
  mimeType: string;
  size: number;
  duration: number;
  source: 'drive' | 'local';
  isOfflineCached: boolean;
  cachedAt?: number;
  addedAt: number;
  liked: boolean;
  coverSeed: number;
  folderName?: string;
  fileName?: string;
  sampleRate?: number;
  bitDepth?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
  coverSeed: number;
  isSystem?: boolean;
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveAudioFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime?: string;
  parents?: string[];
}

export type RepeatMode = 'off' | 'all' | 'one';

export type AppTab = 'home' | 'drive' | 'search' | 'library' | 'playlist' | 'admin' | 'stage';

export type EqPresetId =
  | 'flat'
  | 'bass_boost'
  | 'acoustic'
  | 'vocal'
  | 'lofi_warm'
  | 'electronic'
  | 'rock'
  | 'custom';

export interface EqState {
  enabled: boolean;
  preset: EqPresetId;
  bands: [number, number, number, number, number, number];
}

export interface DownloadProgress {
  trackId: string;
  title: string;
  loaded: number;
  total: number;
  percent: number;
}
