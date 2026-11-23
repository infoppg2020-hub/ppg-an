import { DriveAudioFile, DriveFolder } from '../types/music';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export class DriveAuthError extends Error {
  constructor(message = 'Session ของ Google Drive หมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง') {
    super(message);
    this.name = 'DriveAuthError';
  }
}

export function hashStringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 1000;
}

export function parseTrackMetadata(rawName: string): { title: string; artist: string } {
  const cleanName = rawName.replace(/\.(mp3|m4a|flac|wav|ogg|aac|opus|webm|mp4)$/i, '').trim();
  const withoutTrackNum = cleanName.replace(/^\d{1,3}[\s._-]+/, '').trim();

  const separators = [' - ', ' — ', ' – '];
  for (const sep of separators) {
    const idx = withoutTrackNum.indexOf(sep);
    if (idx > 0 && idx < withoutTrackNum.length - sep.length) {
      const part1 = withoutTrackNum.slice(0, idx).trim();
      const part2 = withoutTrackNum.slice(idx + sep.length).trim();
      if (part1 && part2) {
        return { artist: part1, title: part2 };
      }
    }
  }

  return {
    title: withoutTrackNum || cleanName || 'เพลงไม่มีชื่อ',
    artist: 'Google Drive Audio',
  };
}

const AUDIO_QUERY_CLAUSE =
  "(mimeType contains 'audio/' or name contains '.mp3' or name contains '.m4a' or name contains '.flac' or name contains '.wav' or name contains '.ogg' or name contains '.aac' or name contains '.opus')";

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function listDriveFolders(
  accessToken: string,
  parentId?: string
): Promise<DriveFolder[]> {
  const parentFilter = parentId ? ` and '${escapeDriveQuery(parentId)}' in parents` : " and 'root' in parents";
  const q = `mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentFilter}`;

  const params = new URLSearchParams({
    q,
    fields: 'files(id, name)',
    orderBy: 'name',
    pageSize: '100',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });

  const res = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    throw new DriveAuthError();
  }
  if (!res.ok) {
    throw new Error(`ไม่สามารถดึงรายชื่อโฟลเดอร์จาก Google Drive ได้ (${res.status})`);
  }

  const data = await res.json();
  return (data.files || []) as DriveFolder[];
}

export async function listDriveAudioFiles(
  accessToken: string,
  options?: {
    folderId?: string | null;
    searchQuery?: string;
    pageToken?: string;
  }
): Promise<{ files: DriveAudioFile[]; nextPageToken?: string }> {
  const clauses = ['trashed = false', AUDIO_QUERY_CLAUSE];

  if (options?.folderId) {
    clauses.push(`'${escapeDriveQuery(options.folderId)}' in parents`);
  }

  if (options?.searchQuery?.trim()) {
    clauses.push(`name contains '${escapeDriveQuery(options.searchQuery.trim())}'`);
  }

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)',
    orderBy: 'name',
    pageSize: '100',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });

  if (options?.pageToken) {
    params.set('pageToken', options.pageToken);
  }

  const res = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    throw new DriveAuthError();
  }
  if (!res.ok) {
    throw new Error(`ไม่สามารถดึงรายการเพลงจาก Google Drive ได้ (${res.status})`);
  }

  const data = await res.json();
  const files: DriveAudioFile[] = (data.files || []).map((f: Record<string, unknown>) => ({
    id: String(f.id || ''),
    name: String(f.name || 'Untitled Audio'),
    mimeType: String(f.mimeType || 'audio/mpeg'),
    size: Number(f.size || 0),
    modifiedTime: f.modifiedTime ? String(f.modifiedTime) : undefined,
    parents: Array.isArray(f.parents) ? f.parents.map(String) : undefined,
  }));

  return {
    files,
    nextPageToken: data.nextPageToken ? String(data.nextPageToken) : undefined,
  };
}

export async function downloadDriveAudioBlob(
  accessToken: string,
  fileId: string,
  expectedMimeType?: string,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const res = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });

  if (res.status === 401) {
    throw new DriveAuthError();
  }
  if (!res.ok) {
    throw new Error(`ไม่สามารถดาวน์โหลดไฟล์เสียงได้ (${res.status})`);
  }

  const total = Number(res.headers.get('content-length') || 0);
  const contentType = res.headers.get('content-type') || expectedMimeType || 'audio/mpeg';

  if (!res.body) {
    const blob = await res.blob();
    return new Blob([blob], { type: contentType });
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(loaded, total);
    }
  }

  const blobParts: BlobPart[] = chunks.map((chunk) => {
    const copy = new Uint8Array(chunk.byteLength);
    copy.set(chunk);
    return copy.buffer;
  });
  return new Blob(blobParts, { type: contentType });
}
