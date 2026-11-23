import React from 'react';

interface HiResBadgeProps {
  size?: 'xs' | 'sm' | 'md';
  specLabel?: string;
  className?: string;
}

export const HiResBadge: React.FC<HiResBadgeProps> = ({
  size = 'xs',
  specLabel,
  className = '',
}) => {
  if (size === 'md') {
    return (
      <span
        title={specLabel || 'Hi-Res Audio'}
        className={`inline-flex items-center gap-1.5 rounded-[4px] bg-[#141106]/95 border border-[#E5B83B]/70 px-2 py-1 shadow-md select-none shrink-0 ${className}`}
      >
        <svg
          className="w-3.5 h-3.5 text-[#F5CB49] shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="2"
            y="4"
            width="20"
            height="16"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M6.5 8.5v7M10.5 8.5v7M6.5 12h4M13.5 15.5v-7h2.4a1.9 1.9 0 0 1 0 3.8H13.5m2.3 0 1.9 3.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[10px] font-extrabold tracking-wider text-[#F5CB49] leading-none whitespace-nowrap">
          HI-RES AUDIO
        </span>
      </span>
    );
  }

  if (size === 'sm') {
    return (
      <span
        title={specLabel || 'Hi-Res Audio'}
        className={`inline-flex items-center gap-1 rounded-[3px] bg-[#171307] border border-[#E5B83B]/65 px-1.5 py-0.5 select-none shrink-0 ${className}`}
      >
        <span className="text-[9px] font-extrabold tracking-wider text-[#F5CB49] leading-none whitespace-nowrap">
          HI-RES
        </span>
      </span>
    );
  }

  // xs: ultra-compact inline mark placed directly after song title
  return (
    <span
      title={specLabel || 'Hi-Res Audio'}
      className={`inline-flex items-center gap-1 rounded-[3px] bg-[#171307] border border-[#E5B83B]/60 px-1.5 py-[2px] align-middle select-none shrink-0 ${className}`}
    >
      <svg
        className="w-2.5 h-2.5 text-[#F5CB49] shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[9px] font-extrabold tracking-wider text-[#F5CB49] leading-none whitespace-nowrap">
        HI-RES
      </span>
    </span>
  );
};
