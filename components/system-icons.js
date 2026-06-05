function IconFrame({ children }) {
  return (
    <span className="module-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {children}
      </svg>
    </span>
  );
}

export function BroadcastIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M5 8.5a10 10 0 0 0 0 7" />
      <path d="M19 8.5a10 10 0 0 1 0 7" />
      <path d="M8 10.5a5.5 5.5 0 0 0 0 3" />
      <path d="M16 10.5a5.5 5.5 0 0 1 0 3" />
    </IconFrame>
  );
}

export function PlayIcon() {
  return (
    <IconFrame>
      <path d="M8 6.5v11l8-5.5-8-5.5Z" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function CameraIcon() {
  return (
    <IconFrame>
      <rect x="4" y="7" width="12" height="10" rx="2" />
      <path d="m16 10 4-2v8l-4-2Z" />
    </IconFrame>
  );
}

export function StorageIcon() {
  return (
    <IconFrame>
      <ellipse cx="12" cy="6.5" rx="7" ry="2.5" />
      <path d="M5 6.5v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5" />
      <path d="M5 11.5v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5" />
    </IconFrame>
  );
}

export function PulseIcon() {
  return (
    <IconFrame>
      <path d="M3 12h4l2-4 4 8 2-4h6" />
    </IconFrame>
  );
}

export function LinkIcon() {
  return (
    <IconFrame>
      <path d="M10 14 8.5 15.5a3 3 0 1 1-4.2-4.2L7 8.6" />
      <path d="m14 10 1.5-1.5a3 3 0 1 1 4.2 4.2L17 15.4" />
      <path d="m8.5 15.5 7-7" />
    </IconFrame>
  );
}
