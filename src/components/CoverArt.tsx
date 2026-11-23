import React from 'react';
import { Heart, Music2 } from 'lucide-react';
import { getCoverPalette } from '../utils/formatters';

interface CoverArtProps {
  seed: number;
  title?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isLikedPlaylist?: boolean;
  isPlaying?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CoverArtProps['size']>, string> = {
  xs: 'w-10 h-10 rounded-md',
  sm: 'w-12 h-12 rounded-lg',
  md: 'w-14 h-14 rounded-lg',
  lg: 'w-40 h-40 md:w-48 md:h-48 rounded-2xl',
  xl: 'w-60 h-60 sm:w-72 sm:h-72 rounded-2xl',
};

export const CoverArt: React.FC<CoverArtProps> = ({
  seed,
  isLikedPlaylist = false,
  isPlaying = false,
  size = 'sm',
  className = '',
}) => {
  const palette = getCoverPalette(seed);
  const iconSize =
    size === 'xl'
      ? 'w-20 h-20'
      : size === 'lg'
      ? 'w-14 h-14'
      : size === 'md'
      ? 'w-6 h-6'
      : 'w-5 h-5';

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}
      style={{
        background: isLikedPlaylist
          ? 'linear-gradient(135deg, #4338ca 0%, #7c3aed 55%, #ec4899 100%)'
          : `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.25) 0%, transparent 55%)',
        }}
      />

      {isLikedPlaylist ? (
        <Heart className={`${iconSize} text-white fill-white/90 relative z-10`} />
      ) : (
        <Music2
          className={`${iconSize} relative z-10`}
          style={{ color: palette.accent }}
        />
      )}

      {isPlaying && (
        <div className="absolute inset-0 bg-black/55 flex items-center justify-center gap-1 z-20">
          <span className="w-1 h-4 bg-[#1ED760] rounded-full animate-eq-1" />
          <span className="w-1 h-5 bg-[#1ED760] rounded-full animate-eq-2" />
          <span className="w-1 h-3 bg-[#1ED760] rounded-full animate-eq-3" />
        </div>
      )}
    </div>
  );
};
