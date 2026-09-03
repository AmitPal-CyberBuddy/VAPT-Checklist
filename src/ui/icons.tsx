/** Minimal inline icon set (no icon library dependency). 20x20 stroke icons. */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" />
    <path d="M9.5 12.2l1.8 1.8 3.4-3.6" />
  </Svg>
);

export const IconGrid = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Svg>
);

export const IconList = (p: P) => (
  <Svg {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </Svg>
);

export const IconTarget = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" />
  </Svg>
);

export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5A2.5 2.5 0 016.5 3H19v15H6.5A2.5 2.5 0 004 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 016.5 18H19v3H6.5A2.5 2.5 0 014 20.5z" />
  </Svg>
);

export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v12" />
    <path d="M7.5 10.5L12 15l4.5-4.5" />
    <path d="M4 17v2.5A1.5 1.5 0 005.5 21h13a1.5 1.5 0 001.5-1.5V17" />
  </Svg>
);

export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Svg>
);

export const IconChevron = (p: P) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const IconSettings = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
  </Svg>
);

export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M10.3 3.9L2.6 17a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Svg>
);

export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    <path d="M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7" />
  </Svg>
);

export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
  </Svg>
);

export const IconFilter = (p: P) => (
  <Svg {...p}>
    <path d="M3 5h18l-7 8v6l-4 2v-8z" />
  </Svg>
);

export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);

export const IconExternal = (p: P) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  </Svg>
);

export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </Svg>
);

export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </Svg>
);

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M4 11.5L12 4l8 7.5" />
    <path d="M6.5 10v9.5h11V10" />
    <path d="M10 19.5v-5h4v5" />
  </Svg>
);

export const IconLinkedIn = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 4.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" fill="currentColor" stroke="none" />
    <path d="M4 9.5h3V20H4z" />
    <path d="M10 9.5h2.8v1.4a3 3 0 012.7-1.4c2.9 0 4.5 1.9 4.5 5.3V20h-3v-4.6c0-1.6-.6-2.6-1.9-2.6-1 0-1.8.7-2 1.5V20h-3.1z" />
  </Svg>
);

export const IconGithub = (p: P) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 00-2.9 17.6c.5.1.6-.2.6-.5v-1.8c-2.6.6-3.1-1.2-3.1-1.2-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .8 1.5 2.2 1.1 2.7.8.1-.6.3-1.1.6-1.3-2.1-.3-4.2-1.1-4.2-4.6 0-1 .4-1.9 1-2.5-.1-.3-.5-1.3.1-2.6 0 0 .8-.3 2.7 1a9.2 9.2 0 015 0c1.9-1.3 2.7-1 2.7-1 .6 1.3.2 2.3.1 2.6.6.6 1 1.5 1 2.5 0 3.5-2.1 4.3-4.2 4.6.3.3.6.9.6 1.8V20c0 .3.1.6.6.5A9 9 0 0012 3z" />
  </Svg>
);

export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4 12h15" />
    <path d="M13 6l6 6-6 6" />
  </Svg>
);

export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="6" y="11" width="12" height="9.5" rx="1.5" />
    <path d="M8.5 11V8a3.5 3.5 0 017 0v3" />
    <path d="M12 15v2" />
  </Svg>
);

export const IconLayers = (p: P) => (
  <Svg {...p}>
    <path d="M12 2.5l9 4.75-9 4.75-9-4.75z" />
    <path d="M4.4 12.4l7.6 4 7.6-4" />
    <path d="M4.4 16.4l7.6 4 7.6-4" />
  </Svg>
);

export const IconCheckCircle = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.2l2.5 2.5 4.8-5" />
  </Svg>
);

export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a13.5 13.5 0 010 18" />
    <ellipse cx="12" cy="12" rx="4.5" ry="9" />
  </Svg>
);

export const IconKey = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="12" r="4" />
    <path d="M11 12h9" />
    <path d="M17 9l3 3-3 3" />
  </Svg>
);

export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Svg>
);

export const IconCode = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 7L4 12l4.5 5" />
    <path d="M15.5 7L20 12l-4.5 5" />
  </Svg>
);

export const IconMonitor = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="12.5" rx="1.5" />
    <path d="M9 21h6" />
    <path d="M12 17v4" />
  </Svg>
);

export const IconWorkflow = (p: P) => (
  <Svg {...p}>
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M7 6h10" />
    <path d="M5.5 7.8L12 16" />
    <path d="M18.5 7.8L12 16" />
  </Svg>
);

export const IconFingerprint = (p: P) => (
  <Svg {...p}>
    <path d="M12 3a5.5 5.5 0 00-5.5 5.5c0 4.9-2.3 7.2-3.8 8.7" />
    <path d="M12 3a5.5 5.5 0 015.5 5.5c0 4.9 2.3 7.2 3.8 8.7" />
    <path d="M12 8v6" />
    <path d="M8.8 11.5c.6 2.6 1.9 5 3.2 7 1.3-2 2.6-4.4 3.2-7" />
  </Svg>
);

export const IconFileText = (p: P) => (
  <Svg {...p}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
  </Svg>
);

export const IconServer = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="6" rx="1.5" />
    <rect x="4" y="14" width="16" height="6" rx="1.5" />
    <path d="M7.5 7h.01" />
    <path d="M7.5 17h.01" />
  </Svg>
);

export const IconHexagon = (p: P) => (
  <Svg {...p}>
    <path d="M12 2.5l8.5 5v9l-8.5 5-8.5-5v-9z" />
    <path d="M12 6.5l5.5 3.2v4.6L12 17.5l-5.5-3.2v-4.6z" opacity="0.45" />
  </Svg>
);

export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconGauge = (p: P) => (
  <Svg {...p}>
    <path d="M5 18a8 8 0 1114 0" />
    <path d="M12 14l4.5-4.5" />
    <path d="M3.5 18h17" />
  </Svg>
);

export const IconShieldCheck = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </Svg>
);

export const IconCloud = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 17.5a4 4 0 01-.6-7.96A5.5 5.5 0 0117 8.2a4.5 4.5 0 01-.5 9.3z" />
  </Svg>
);

export const IconSmartphone = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2" />
    <path d="M11 18.5h2" />
  </Svg>
);

/* ------------------------------------------ status & result iconography
 * The instrument set for test states. Drawn at 10–13px with a heavier
 * stroke (2.5) so they stay crisp at badge size. Every status carries one
 * of these plus its text label — never colour or shape alone. */

/** Not Tested — an open ring: nothing recorded yet. */
export const IconCircle = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
  </Svg>
);

/** Tested — a filled disc: the test has been performed. */
export const IconCircleFilled = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="6.5" fill="currentColor" stroke="none" />
  </Svg>
);

/** N/A — a struck circle: excluded in practice. */
export const IconBan = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M6.5 6.5l11 11" />
  </Svg>
);

/** Limited / partial — a half-filled disc: coverage with gaps. */
export const IconCircleHalf = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
  </Svg>
);

/** High value — a four-point spark: worth doing early. */
export const IconSpark = (p: P) => (
  <Svg {...p}>
    <path d="M12 2.5l2.3 7.2 7.2 2.3-7.2 2.3L12 21.5l-2.3-7.2L2.5 12l7.2-2.3z" />
  </Svg>
);

