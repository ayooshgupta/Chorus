export function AssignmentIcon({ kind }: { kind: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  };

  if (kind === 'alternating') {
    return (
      <svg {...common}>
        <path d="M2 5h9l-2.2-2.2M14 11H5l2.2 2.2" />
      </svg>
    );
  }

  if (kind === 'adhoc') {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="2.2" />
        <circle cx="11" cy="6.6" r="1.7" />
        <path d="M2 13c.6-2 2.1-3 4-3s3.4 1 4 3" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="8" cy="5.5" r="2.6" />
      <path d="M3 13.5c.7-2.4 2.5-3.6 5-3.6s4.3 1.2 5 3.6" />
    </svg>
  );
}

export function TabIcon({ kind, on }: { kind: 'board' | 'household' | 'activity'; on: boolean }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: on ? 2 : 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  };

  if (kind === 'board') {
    return (
      <svg {...common}>
        <path d="M4 7.5l2 2 3.5-3.5M4 16.5l2 2 3.5-3.5M13 7.5h7M13 16.5h7" />
      </svg>
    );
  }

  if (kind === 'household') {
    return (
      <svg {...common}>
        <path d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M3 12.5h4l2.5-6 4 12 2.5-6h5" />
    </svg>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 120ms ease'
      }}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
