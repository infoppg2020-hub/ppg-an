import { Track } from '../types/music';

export interface AudioQualityInfo {
  isHiRes: boolean;
  formatLabel: string;
  specLabel: string;
}

/**
 * Inspects the first 64 bytes of a FLAC or WAV blob to read real sampleRate & bitDepth.
 */
export async function detectBlobAudioSpecs(
  blob: Blob
): Promise<{ sampleRate?: number; bitDepth?: number }> {
  try {
    const slice = blob.slice(0, 64);
    const buf = await slice.arrayBuffer();
    const view = new DataView(buf);
    if (buf.byteLength < 36) return {};

    // Check FLAC signature: "fLaC" (0x66 0x4C 0x61 0x43)
    if (
      view.getUint8(0) === 0x66 &&
      view.getUint8(1) === 0x4c &&
      view.getUint8(2) === 0x61 &&
      view.getUint8(3) === 0x43
    ) {
      // Metadata block header at byte 4..7, STREAMINFO starts at byte 8
      // Sample rate (20 bits) + channels (3 bits) + bps (5 bits) at bytes 18..21
      if (buf.byteLength >= 22) {
        const b18 = view.getUint8(18);
        const b19 = view.getUint8(19);
        const b20 = view.getUint8(20);
        const b21 = view.getUint8(21);

        const sampleRate = (b18 << 12) | (b19 << 4) | (b20 >> 4);
        const bpsMinus1 = ((b20 & 0x01) << 4) | (b21 >> 4);
        const bitDepth = bpsMinus1 + 1;

        if (sampleRate > 0 && bitDepth >= 8) {
          return { sampleRate, bitDepth };
        }
      }
    }

    // Check WAV signature: "RIFF" (0..3) and "WAVE" (8..11)
    if (
      view.getUint8(0) === 0x52 &&
      view.getUint8(1) === 0x49 &&
      view.getUint8(2) === 0x46 &&
      view.getUint8(3) === 0x46 &&
      view.getUint8(8) === 0x57 &&
      view.getUint8(9) === 0x41 &&
      view.getUint8(10) === 0x56 &&
      view.getUint8(11) === 0x45
    ) {
      const sampleRate = view.getUint32(24, true);
      const bitDepth = view.getUint16(34, true);
      if (sampleRate > 0 && bitDepth >= 8) {
        return { sampleRate, bitDepth };
      }
    }
  } catch {
    // Ignore header parse errors
  }
  return {};
}

export function getTrackAudioQuality(
  track: Track | null | undefined
): AudioQualityInfo {
  if (!track) {
    return { isHiRes: false, formatLabel: 'Audio', specLabel: '' };
  }

  const mime = (track.mimeType || '').toLowerCase();
  const text = `${track.fileName || ''} ${track.title || ''} ${track.album || ''}`.toLowerCase();

  const isFlac = mime.includes('flac') || /\.(flac)$/i.test(text);
  const isWav = mime.includes('wav') || /\.(wav|wave)$/i.test(text);
  const isAiff = mime.includes('aiff') || /\.(aiff|aif)$/i.test(text);
  const isAlac = mime.includes('alac') || /\b(alac)\b/i.test(text);
  const isDsd = mime.includes('dsd') || /\.(dsf|dff)$/i.test(text);

  const hasHiResTag =
    /\b(hi-?res|hires|lossless|master|24[\s-]?bit|32[\s-]?bit|96\s?khz|192\s?khz|88\.2\s?khz|176\.4\s?khz|384\s?khz)\b/i.test(
      text
    );

  const bitrateBps =
    track.duration > 0 && track.size > 0
      ? (track.size * 8) / track.duration
      : 0;
  const isHighBitrateLossless = bitrateBps >= 900_000;

  const hasHiResSpecs =
    (track.bitDepth !== undefined && track.bitDepth >= 24) ||
    (track.sampleRate !== undefined && track.sampleRate > 48000);

  const isHiRes =
    isFlac ||
    isWav ||
    isAiff ||
    isAlac ||
    isDsd ||
    hasHiResTag ||
    hasHiResSpecs ||
    isHighBitrateLossless;

  let formatLabel = 'Audio';
  if (isFlac) formatLabel = 'FLAC';
  else if (isWav) formatLabel = 'WAV';
  else if (isAiff) formatLabel = 'AIFF';
  else if (isAlac) formatLabel = 'ALAC';
  else if (isDsd) formatLabel = 'DSD';
  else if (mime.includes('mp4') || mime.includes('aac') || /\.(m4a|aac)$/i.test(text))
    formatLabel = 'AAC';
  else if (mime.includes('mpeg') || /\.(mp3)$/i.test(text)) formatLabel = 'MP3';
  else if (mime.includes('ogg') || mime.includes('opus')) formatLabel = 'OGG';

  let specLabel = formatLabel;
  if (track.bitDepth && track.sampleRate) {
    const khz = Number((track.sampleRate / 1000).toFixed(1));
    specLabel = `${track.bitDepth}-bit / ${khz} kHz`;
  } else if (isHiRes) {
    specLabel = `${formatLabel} · Hi-Res Audio`;
  }

  return {
    isHiRes,
    formatLabel,
    specLabel,
  };
}
