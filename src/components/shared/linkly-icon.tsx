export function LinklyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={className}>
      <defs>
        <linearGradient id="linkly-g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b6ff5" />
          <stop offset="100%" stopColor="#144ee3" />
        </linearGradient>
        <linearGradient id="linkly-g2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d64a80" />
          <stop offset="100%" stopColor="#eb568e" />
        </linearGradient>
      </defs>
      <rect
        x="108"
        y="108"
        width="200"
        height="200"
        rx="64"
        fill="none"
        stroke="url(#linkly-g1)"
        strokeWidth="48"
        transform="rotate(-45 208 208)"
      />
      <rect
        x="204"
        y="204"
        width="200"
        height="200"
        rx="64"
        fill="none"
        stroke="url(#linkly-g2)"
        strokeWidth="48"
        transform="rotate(-45 304 304)"
      />
    </svg>
  );
}
