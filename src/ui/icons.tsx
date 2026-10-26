import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconUndo = () => (
  <Svg>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
);
export const IconHint = () => (
  <Svg>
    <path d="M9 18h6M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z" />
  </Svg>
);
export const IconFlip = () => (
  <Svg>
    <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
    <path d="M3 21v-5h5" />
  </Svg>
);
export const IconMenu = () => (
  <Svg>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
);
export const IconList = () => (
  <Svg>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </Svg>
);
export const IconFlag = () => (
  <Svg>
    <path d="M4 22V4" />
    <path d="M4 4h12l-2 4 2 4H4" />
  </Svg>
);
export const IconHandshake = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 10h8M8 14h8" />
  </Svg>
);
export const IconPause = () => (
  <Svg>
    <path d="M9 5v14M15 5v14" />
  </Svg>
);
export const IconPlay = () => (
  <Svg>
    <path d="M7 4v16l13-8Z" />
  </Svg>
);
export const IconRestart = () => (
  <Svg>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
);
export const IconSave = () => (
  <Svg>
    <path d="M5 3h11l3 3v15H5Z" />
    <path d="M8 3v5h7V3M8 21v-7h8v7" />
  </Svg>
);
export const IconPgn = () => (
  <Svg>
    <path d="M14 3H6v18h12V7Z" />
    <path d="M14 3v4h4M9 13h6M9 17h6" />
  </Svg>
);
export const IconSound = ({ on }: { on: boolean }) => (
  <Svg>
    <path d="M4 9v6h4l5 4V5L8 9Z" />
    {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="m17 9 5 6M22 9l-5 6" />}
  </Svg>
);
export const IconClose = () => (
  <Svg>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconMore = () => (
  <Svg>
    <circle cx="5" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="19" cy="12" r="1.2" />
  </Svg>
);
export const IconExpand = () => (
  <Svg>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);
export const IconShrink = () => (
  <Svg>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </Svg>
);
export const IconPanel = ({ open }: { open: boolean }) => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M15 4v16" />
    <path d={open ? 'M8 10l2 2-2 2' : 'M10 10l-2 2 2 2'} />
  </Svg>
);
