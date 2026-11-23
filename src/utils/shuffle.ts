import { Track } from '../types/music';

/**
 * Unbiased Fisher-Yates shuffle returning a new array.
 */
export function fisherYatesShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Builds an offline-safe playback queue.
 * - When offline (`!isOnline`), filters out uncached cloud-only tracks so shuffle/playback never stalls.
 * - When `shuffle` is true, applies Fisher-Yates shuffle while keeping `anchorTrackId` first if specified.
 */
export function buildPlaybackQueue(
  trackIds: string[],
  tracksById: Record<string, Track>,
  options: {
    shuffle: boolean;
    isOnline: boolean;
    anchorTrackId?: string | null;
  }
): string[] {
  const validIds = trackIds.filter((id) => {
    const track = tracksById[id];
    if (!track) return false;
    if (!options.isOnline && !track.isOfflineCached) return false;
    return true;
  });

  if (!options.shuffle) {
    return validIds;
  }

  if (options.anchorTrackId && validIds.includes(options.anchorTrackId)) {
    const rest = validIds.filter((id) => id !== options.anchorTrackId);
    return [options.anchorTrackId, ...fisherYatesShuffle(rest)];
  }

  return fisherYatesShuffle(validIds);
}
