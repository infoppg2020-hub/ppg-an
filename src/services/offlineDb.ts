import { Playlist, Track } from '../types/music';

const DB_NAME = 'spotiflow_offline_db';
const DB_VERSION = 1;

const STORE_TRACKS = 'tracks';
const STORE_BLOBS = 'audioBlobs';
const STORE_PLAYLISTS = 'playlists';

export interface StoredAudioBlob {
  id: string;
  blob: Blob;
  mimeType: string;
  size: number;
  cachedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
        db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = executor(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      })
  );
}

export async function getAllTracks(): Promise<Track[]> {
  const tracks = await runTx<Track[]>(STORE_TRACKS, 'readonly', (store) => store.getAll());
  return (tracks || []).sort((a, b) => b.addedAt - a.addedAt);
}

export async function upsertTrack(track: Track): Promise<void> {
  await runTx(STORE_TRACKS, 'readwrite', (store) => store.put(track));
}

export async function upsertTracks(tracks: Track[]): Promise<void> {
  if (tracks.length === 0) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    const store = tx.objectStore(STORE_TRACKS);
    tracks.forEach((t) => store.put(t));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deleteTrackRecord(trackId: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_TRACKS, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_TRACKS).delete(trackId);
    tx.objectStore(STORE_BLOBS).delete(trackId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function saveAudioBlob(
  trackId: string,
  blob: Blob,
  mimeType: string
): Promise<void> {
  const record: StoredAudioBlob = {
    id: trackId,
    blob,
    mimeType: mimeType || blob.type || 'audio/mpeg',
    size: blob.size,
    cachedAt: Date.now(),
  };
  await runTx(STORE_BLOBS, 'readwrite', (store) => store.put(record));
}

export async function getAudioBlob(trackId: string): Promise<StoredAudioBlob | undefined> {
  return runTx<StoredAudioBlob | undefined>(STORE_BLOBS, 'readonly', (store) =>
    store.get(trackId)
  );
}

export async function deleteAudioBlob(trackId: string): Promise<void> {
  await runTx(STORE_BLOBS, 'readwrite', (store) => store.delete(trackId));
}

export async function getAllPlaylists(): Promise<Playlist[]> {
  const playlists = await runTx<Playlist[]>(STORE_PLAYLISTS, 'readonly', (store) =>
    store.getAll()
  );
  if (!playlists || playlists.length === 0) {
    const liked: Playlist = {
      id: 'liked',
      name: 'เพลงที่ถูกใจ',
      description: 'รวบรวมเพลงโปรดของคุณสำหรับฟังแบบออฟไลน์',
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      coverSeed: 101,
      isSystem: true,
    };
    await savePlaylist(liked);
    return [liked];
  }
  return playlists.sort((a, b) => {
    if (a.isSystem && !b.isSystem) return -1;
    if (!a.isSystem && b.isSystem) return 1;
    return b.updatedAt - a.updatedAt;
  });
}

export async function savePlaylist(playlist: Playlist): Promise<void> {
  await runTx(STORE_PLAYLISTS, 'readwrite', (store) => store.put(playlist));
}

export async function deletePlaylistRecord(playlistId: string): Promise<void> {
  await runTx(STORE_PLAYLISTS, 'readwrite', (store) => store.delete(playlistId));
}

export async function getOfflineStorageStats(): Promise<{
  cachedBytes: number;
  cachedCount: number;
  quotaBytes: number | null;
  usageBytes: number | null;
}> {
  const blobs = await runTx<StoredAudioBlob[]>(STORE_BLOBS, 'readonly', (store) =>
    store.getAll()
  );
  const cachedBytes = (blobs || []).reduce((sum, item) => sum + (item.size || 0), 0);

  let quotaBytes: number | null = null;
  let usageBytes: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      quotaBytes = estimate.quota ?? null;
      usageBytes = estimate.usage ?? null;
    } catch {
      // Ignore storage estimate errors in restricted contexts
    }
  }

  return {
    cachedBytes,
    cachedCount: (blobs || []).length,
    quotaBytes,
    usageBytes,
  };
}
