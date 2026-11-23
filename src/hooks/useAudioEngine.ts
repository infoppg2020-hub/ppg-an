import { useCallback, useEffect, useRef, useState } from 'react';
import {
  downloadDriveAudioBlob,
  DriveAuthError,
} from '../services/driveApi';
import { getAccessToken } from '../services/firebaseAuth';
import {
  getAudioBlob,
  saveAudioBlob,
  upsertTrack,
} from '../services/offlineDb';
import { EqPresetId, EqState, RepeatMode, Track } from '../types/music';
import { detectBlobAudioSpecs } from '../utils/audioQuality';
import {
  EQ_BANDS,
  EQ_PRESETS,
  loadSavedEqState,
  saveEqState,
} from '../utils/eqPresets';
import { generateMediaArtworkDataUrl } from '../utils/formatters';
import { buildPlaybackQueue } from '../utils/shuffle';

interface UseAudioEngineOptions {
  tracksById: Record<string, Track>;
  isOnline: boolean;
  autoCacheOnPlay?: boolean;
  onTrackUpdated: (track: Track) => void;
  onRequireAuth: () => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export function useAudioEngine({
  tracksById,
  isOnline,
  autoCacheOnPlay = true,
  onTrackUpdated,
  onRequireAuth,
  onNotify,
}: UseAudioEngineOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [queue, setQueue] = useState<string[]>([]);
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [eqState, setEqState] = useState<EqState>(() => loadSavedEqState());

  // Refs for latest closures inside native audio & MediaSession callbacks
  const stateRef = useRef({
    queue,
    originalOrder,
    currentTrackId,
    isPlaying,
    isShuffle,
    repeatMode,
    tracksById,
    isOnline,
  });
  stateRef.current = {
    queue,
    originalOrder,
    currentTrackId,
    isPlaying,
    isShuffle,
    repeatMode,
    tracksById,
    isOnline,
  };

  if (!audioRef.current && typeof Audio !== 'undefined') {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = volume;
    audioRef.current = audio;
  }

  const syncEqFiltersToAudioCtx = useCallback((stateToApply: EqState) => {
    const ctx = audioCtxRef.current;
    const filters = eqFiltersRef.current;
    if (!ctx || filters.length !== EQ_BANDS.length) return;
    filters.forEach((filter, idx) => {
      const targetDb = stateToApply.enabled ? stateToApply.bands[idx] || 0 : 0;
      filter.gain.setTargetAtTime(targetDb, ctx.currentTime, 0.02);
    });
  }, []);

  const ensureAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioCtxRef.current) {
      try {
        const ctx = new AudioCtx();
        const source = ctx.createMediaElementSource(audio);
        const filters = EQ_BANDS.map((meta) => {
          const filter = ctx.createBiquadFilter();
          filter.type = meta.type;
          filter.frequency.value = meta.freq;
          if (meta.type === 'peaking') {
            filter.Q.value = 1.1;
          }
          filter.gain.value = eqState.enabled ? eqState.bands[meta.index] || 0 : 0;
          return filter;
        });

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.78;

        let prevNode: AudioNode = source;
        for (const filter of filters) {
          prevNode.connect(filter);
          prevNode = filter;
        }
        prevNode.connect(analyser);
        analyser.connect(ctx.destination);

        audioCtxRef.current = ctx;
        sourceNodeRef.current = source;
        eqFiltersRef.current = filters;
        analyserRef.current = analyser;
      } catch {
        // Fallback to direct HTMLAudioElement playback if AudioContext fails
      }
    }

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      try {
        await audioCtxRef.current.resume();
      } catch {
        // Ignore resume failure
      }
    }
  }, [eqState.bands, eqState.enabled]);

  useEffect(() => {
    syncEqFiltersToAudioCtx(eqState);
    saveEqState(eqState);
  }, [eqState, syncEqFiltersToAudioCtx]);

  const setEqEnabled = useCallback((enabled: boolean) => {
    setEqState((prev) => ({ ...prev, enabled }));
  }, []);

  const setEqBand = useCallback((bandIndex: number, gainDb: number) => {
    const clamped = Math.max(-12, Math.min(12, Math.round(gainDb * 2) / 2));
    setEqState((prev) => {
      const nextBands = [...prev.bands] as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      nextBands[bandIndex] = clamped;
      return {
        ...prev,
        enabled: true,
        preset: 'custom',
        bands: nextBands,
      };
    });
  }, []);

  const applyEqPreset = useCallback((presetId: Exclude<EqPresetId, 'custom'>) => {
    const found = EQ_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setEqState({
      enabled: true,
      preset: found.id,
      bands: [...found.bands] as [number, number, number, number, number, number],
    });
  }, []);

  const getOrCreateBlobUrl = useCallback(async (track: Track): Promise<string | null> => {
    const existing = blobUrlCacheRef.current.get(track.id);
    if (existing) return existing;

    // 1. Check IndexedDB offline store first (works 100% offline)
    const stored = await getAudioBlob(track.id);
    if (stored?.blob) {
      const url = URL.createObjectURL(stored.blob);
      blobUrlCacheRef.current.set(track.id, url);
      if (!track.sampleRate || !track.bitDepth) {
        void detectBlobAudioSpecs(stored.blob).then(async (specs) => {
          if (
            (specs.sampleRate && specs.sampleRate !== track.sampleRate) ||
            (specs.bitDepth && specs.bitDepth !== track.bitDepth)
          ) {
            const enriched: Track = {
              ...track,
              sampleRate: specs.sampleRate ?? track.sampleRate,
              bitDepth: specs.bitDepth ?? track.bitDepth,
            };
            await upsertTrack(enriched);
            onTrackUpdated(enriched);
          }
        });
      }
      return url;
    }

    // 2. Otherwise stream from Google Drive if online
    if (!stateRef.current.isOnline) {
      throw new Error('ไม่มีการเชื่อมต่ออินเทอร์เน็ต และเพลงนี้ยังไม่ได้บันทึกไว้แบบออฟไลน์');
    }

    if (track.source === 'drive' && track.driveFileId) {
      const token = getAccessToken();
      if (!token) {
        onRequireAuth();
        throw new DriveAuthError('กรุณาเชื่อมต่อ Google Drive ก่อนเล่นเพลงที่ยังไม่โหลดออฟไลน์');
      }
      const blob = await downloadDriveAudioBlob(token, track.driveFileId, track.mimeType);
      const url = URL.createObjectURL(blob);
      blobUrlCacheRef.current.set(track.id, url);
      const specs = await detectBlobAudioSpecs(blob);

      // Persist downloaded Drive audio offline automatically if enabled
      if (autoCacheOnPlay) {
        try {
          await saveAudioBlob(track.id, blob, track.mimeType);
          const updated: Track = {
            ...track,
            fileName: track.fileName || track.title,
            sampleRate: specs.sampleRate ?? track.sampleRate,
            bitDepth: specs.bitDepth ?? track.bitDepth,
            isOfflineCached: true,
            cachedAt: Date.now(),
            size: track.size || blob.size,
          };
          await upsertTrack(updated);
          onTrackUpdated(updated);
        } catch {
          // Quota might be full; still play from memory blob URL
        }
      } else if (
        (specs.sampleRate && specs.sampleRate !== track.sampleRate) ||
        (specs.bitDepth && specs.bitDepth !== track.bitDepth)
      ) {
        const enriched: Track = {
          ...track,
          sampleRate: specs.sampleRate ?? track.sampleRate,
          bitDepth: specs.bitDepth ?? track.bitDepth,
        };
        await upsertTrack(enriched);
        onTrackUpdated(enriched);
      }

      return url;
    }

    throw new Error('ไม่พบไฟล์เสียงสำหรับเพลงนี้');
  }, [autoCacheOnPlay, onRequireAuth, onTrackUpdated]);

  const preloadNextTrack = useCallback(async (currentId: string) => {
    const { queue: q, tracksById: map } = stateRef.current;
    if (q.length <= 1) return;
    const idx = q.indexOf(currentId);
    if (idx === -1) return;
    const nextId = q[(idx + 1) % q.length];
    const nextTrack = map[nextId];
    if (!nextTrack || blobUrlCacheRef.current.has(nextId)) return;
    if (nextTrack.isOfflineCached) {
      try {
        const stored = await getAudioBlob(nextId);
        if (stored?.blob) {
          blobUrlCacheRef.current.set(nextId, URL.createObjectURL(stored.blob));
        }
      } catch {
        // Ignore preload error
      }
    }
  }, []);

  const updateMediaSession = useCallback((track: Track | null, playing: boolean) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    const artworkUrl = generateMediaArtworkDataUrl(track.title, track.coverSeed);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || 'Spotiflow Offline',
      artwork: [
        { src: artworkUrl, sizes: '512x512', type: 'image/png' },
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      ],
    });
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, []);

  const syncPositionState = useCallback(() => {
    const audio = audioRef.current;
    if (
      !audio ||
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      !navigator.mediaSession.setPositionState
    ) {
      return;
    }
    const dur = audio.duration;
    if (Number.isFinite(dur) && dur > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: audio.playbackRate || 1,
          position: Math.min(audio.currentTime || 0, dur),
        });
      } catch {
        // Ignore invalid position state
      }
    }
  }, []);

  const playTrackById = useCallback(
    async (trackId: string) => {
      const audio = audioRef.current;
      const track = stateRef.current.tracksById[trackId];
      if (!audio || !track) return;

      setCurrentTrackId(trackId);
      setCurrentTime(0);
      setDuration(track.duration || 0);
      updateMediaSession(track, true);
      await ensureAudioGraph();

      // Synchronous path when already resolved in memory (crucial for locked-screen continuity)
      const instantUrl = blobUrlCacheRef.current.get(trackId);
      if (instantUrl) {
        audio.src = instantUrl;
        audio.currentTime = 0;
        try {
          await audio.play();
          setIsPlaying(true);
          setIsBuffering(false);
          void preloadNextTrack(trackId);
          return;
        } catch {
          setIsPlaying(false);
          return;
        }
      }

      setIsBuffering(true);
      try {
        const url = await getOrCreateBlobUrl(track);
        if (!url) return;
        if (stateRef.current.currentTrackId !== trackId) {
          return;
        }
        audio.src = url;
        audio.currentTime = 0;
        await audio.play();
        setIsPlaying(true);
        void preloadNextTrack(trackId);
      } catch (err) {
        setIsPlaying(false);
        if (err instanceof DriveAuthError) {
          onNotify(err.message, 'info');
        } else {
          onNotify(
            err instanceof Error ? err.message : 'ไม่สามารถเล่นเพลงนี้ได้',
            'error'
          );
        }
      } finally {
        setIsBuffering(false);
      }
    },
    [ensureAudioGraph, getOrCreateBlobUrl, onNotify, preloadNextTrack, updateMediaSession]
  );

  const playFromList = useCallback(
    async (
      trackIds: string[],
      startTrackId?: string,
      forceShuffle?: boolean
    ) => {
      const { tracksById: map, isOnline: online, isShuffle: currentShuffle } = stateRef.current;
      const useShuffle = forceShuffle !== undefined ? forceShuffle : currentShuffle;

      if (forceShuffle !== undefined) {
        setIsShuffle(forceShuffle);
      }

      const cleanOriginal = trackIds.filter((id) => Boolean(map[id]));
      if (cleanOriginal.length === 0) {
        onNotify('ยังไม่มีเพลงในรายการนี้', 'info');
        return;
      }

      const builtQueue = buildPlaybackQueue(cleanOriginal, map, {
        shuffle: useShuffle,
        isOnline: online,
        anchorTrackId: useShuffle && !startTrackId ? undefined : startTrackId,
      });

      if (builtQueue.length === 0) {
        onNotify(
          'ไม่มีเพลงที่บันทึกแบบออฟไลน์ในเพลย์ลิสต์นี้ กรุณาเชื่อมต่ออินเทอร์เน็ตหรือดาวน์โหลดเพลงเก็บไว้ก่อน',
          'info'
        );
        return;
      }

      setOriginalOrder(cleanOriginal);
      setQueue(builtQueue);
      const targetId = startTrackId && builtQueue.includes(startTrackId) ? startTrackId : builtQueue[0];
      stateRef.current.queue = builtQueue;
      stateRef.current.currentTrackId = targetId;
      await playTrackById(targetId);
    },
    [onNotify, playTrackById]
  );

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    const { currentTrackId: id, tracksById: map } = stateRef.current;
    if (!audio) return;

    if (!id) {
      const availableIds = Object.keys(map);
      if (availableIds.length > 0) {
        await playFromList(availableIds);
      }
      return;
    }

    if (audio.paused) {
      if (!audio.src) {
        await playTrackById(id);
      } else {
        try {
          await ensureAudioGraph();
          await audio.play();
          setIsPlaying(true);
          updateMediaSession(map[id] || null, true);
          syncPositionState();
        } catch {
          await playTrackById(id);
        }
      }
    } else {
      audio.pause();
      setIsPlaying(false);
      updateMediaSession(map[id] || null, false);
      syncPositionState();
    }
  }, [ensureAudioGraph, playFromList, playTrackById, syncPositionState, updateMediaSession]);

  const nextTrack = useCallback(
    async (fromAutoEnded = false) => {
      const {
        queue: q,
        currentTrackId: id,
        repeatMode: repeat,
        isOnline: online,
        tracksById: map,
        isShuffle: shuffleActive,
      } = stateRef.current;

      if (q.length === 0 || !id) return;

      if (fromAutoEnded && repeat === 'one') {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          await audio.play();
          setIsPlaying(true);
          syncPositionState();
        }
        return;
      }

      const currentIdx = q.indexOf(id);
      const isLast = currentIdx === q.length - 1 || currentIdx === -1;

      if (fromAutoEnded && isLast && repeat === 'off') {
        setIsPlaying(false);
        updateMediaSession(map[id] || null, false);
        return;
      }

      // If offline, skip tracks that aren't cached offline
      let candidateIdx = (currentIdx + 1) % q.length;
      if (!online) {
        let hops = 0;
        while (hops < q.length && !map[q[candidateIdx]]?.isOfflineCached) {
          candidateIdx = (candidateIdx + 1) % q.length;
          hops++;
        }
        if (!map[q[candidateIdx]]?.isOfflineCached) {
          setIsPlaying(false);
          onNotify('สิ้นสุดเพลงออฟไลน์ที่มีอยู่ในคิวแล้ว', 'info');
          return;
        }
      }

      // If cycling back to start in shuffle mode, re-shuffle for fresh variety!
      if (isLast && shuffleActive && q.length > 2) {
        const reshuffled = buildPlaybackQueue(stateRef.current.originalOrder, map, {
          shuffle: true,
          isOnline: online,
        });
        if (reshuffled.length > 0) {
          const picked = reshuffled[0] === id && reshuffled.length > 1 ? reshuffled[1] : reshuffled[0];
          setQueue(reshuffled);
          stateRef.current.queue = reshuffled;
          await playTrackById(picked);
          return;
        }
      }

      await playTrackById(q[candidateIdx]);
    },
    [onNotify, playTrackById, syncPositionState, updateMediaSession]
  );

  const prevTrack = useCallback(async () => {
    const audio = audioRef.current;
    const { queue: q, currentTrackId: id, isOnline: online, tracksById: map } = stateRef.current;
    if (!audio || q.length === 0 || !id) return;

    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      syncPositionState();
      return;
    }

    const currentIdx = q.indexOf(id);
    let prevIdx = (currentIdx - 1 + q.length) % q.length;
    if (!online) {
      let hops = 0;
      while (hops < q.length && !map[q[prevIdx]]?.isOfflineCached) {
        prevIdx = (prevIdx - 1 + q.length) % q.length;
        hops++;
      }
    }

    await playTrackById(q[prevIdx]);
  }, [playTrackById, syncPositionState]);

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(seconds)) return;
      const clamped = Math.max(0, Math.min(audio.duration || duration || 0, seconds));
      audio.currentTime = clamped;
      setCurrentTime(clamped);
      syncPositionState();
    },
    [duration, syncPositionState]
  );

  const toggleShuffle = useCallback(() => {
    const {
      isShuffle: currentlyShuffled,
      originalOrder: orig,
      currentTrackId: id,
      tracksById: map,
      isOnline: online,
    } = stateRef.current;
    const nextShuffle = !currentlyShuffled;
    setIsShuffle(nextShuffle);

    if (orig.length > 0) {
      const nextQueue = buildPlaybackQueue(orig, map, {
        shuffle: nextShuffle,
        isOnline: online,
        anchorTrackId: id,
      });
      setQueue(nextQueue);
      if (id) void preloadNextTrack(id);
    }

    onNotify(
      nextShuffle ? 'เปิดการสุ่มเพลงในเพลย์ลิสต์ (รองรับออฟไลน์)' : 'ปิดการสุ่มเพลง',
      'info'
    );
  }, [onNotify, preloadNextTrack]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      const next: RepeatMode = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      const label =
        next === 'all'
          ? 'เล่นซ้ำทั้งเพลย์ลิสต์'
          : next === 'one'
          ? 'เล่นซ้ำเพลงนี้'
          : 'ปิดการเล่นซ้ำ';
      onNotify(label, 'info');
      return next;
    });
  }, [onNotify]);

  const changeVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolume(clamped);
    setIsMuted(clamped === 0);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      audioRef.current.muted = clamped === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
      }
      return next;
    });
  }, []);

  // Wire native HTMLAudioElement events & MediaSession lock-screen controls
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      if (
        audio.duration &&
        audio.duration - audio.currentTime < 15 &&
        stateRef.current.currentTrackId
      ) {
        void preloadNextTrack(stateRef.current.currentTrackId);
      }
    };

    const handleLoadedMetadata = () => {
      const realDuration = audio.duration;
      if (Number.isFinite(realDuration) && realDuration > 0) {
        setDuration(realDuration);
        syncPositionState();
        const activeId = stateRef.current.currentTrackId;
        const activeTrack = activeId ? stateRef.current.tracksById[activeId] : undefined;
        if (activeTrack && Math.abs((activeTrack.duration || 0) - realDuration) > 1) {
          const updated = { ...activeTrack, duration: realDuration };
          void upsertTrack(updated);
          onTrackUpdated(updated);
        }
      }
    };

    const handleEnded = () => {
      void nextTrack(true);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      const id = stateRef.current.currentTrackId;
      updateMediaSession(id ? stateRef.current.tracksById[id] || null : null, true);
      syncPositionState();
    };

    const handlePause = () => {
      setIsPlaying(false);
      const id = stateRef.current.currentTrackId;
      updateMediaSession(id ? stateRef.current.tracksById[id] || null : null, false);
      syncPositionState();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    if ('mediaSession' in navigator) {
      const safeSetHandler = (
        action: MediaSessionAction,
        handler: MediaSessionActionHandler | null
      ) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch {
          // Some browsers do not support every MediaSessionAction
        }
      };

      safeSetHandler('play', () => {
        void togglePlay();
      });
      safeSetHandler('pause', () => {
        void togglePlay();
      });
      safeSetHandler('previoustrack', () => {
        void prevTrack();
      });
      safeSetHandler('nexttrack', () => {
        void nextTrack(false);
      });
      safeSetHandler('seekbackward', (details) => {
        seekTo((audio.currentTime || 0) - (details.seekOffset || 10));
      });
      safeSetHandler('seekforward', (details) => {
        seekTo((audio.currentTime || 0) + (details.seekOffset || 10));
      });
      safeSetHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          seekTo(details.seekTime);
        }
      });
      safeSetHandler('stop', () => {
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
      });
    }

    const handleVisibilityChange = () => {
      if (!audio.paused) {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          void audioCtxRef.current.resume().catch(() => {});
        }
        syncPositionState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [
    nextTrack,
    onTrackUpdated,
    preloadNextTrack,
    prevTrack,
    seekTo,
    syncPositionState,
    togglePlay,
    updateMediaSession,
  ]);

  const currentTrack = currentTrackId ? tracksById[currentTrackId] || null : null;

  return {
    currentTrack,
    currentTrackId,
    queue,
    isPlaying,
    isBuffering,
    isShuffle,
    repeatMode,
    currentTime,
    duration,
    volume,
    isMuted,
    eqState,
    analyserRef,
    setEqEnabled,
    setEqBand,
    applyEqPreset,
    playFromList,
    playTrackById,
    togglePlay,
    nextTrack: () => nextTrack(false),
    prevTrack,
    seekTo,
    toggleShuffle,
    cycleRepeat,
    changeVolume,
    toggleMute,
    clearCachedUrlForTrack: (trackId: string) => {
      const url = blobUrlCacheRef.current.get(trackId);
      if (url) {
        URL.revokeObjectURL(url);
        blobUrlCacheRef.current.delete(trackId);
      }
    },
  };
}
