export function LogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 60" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="mm-logo-g" x1="0" y1="0" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D" />
          <stop offset="0.5" stopColor="#FB923C" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      {/* M body */}
      <path
        d="M4 52L4 14L28 38L52 14L52 52L44 52L44 26L28 44L12 26L12 52Z"
        fill="url(#mm-logo-g)"
      />
      {/* Upward arrow on top-right */}
      <path
        d="M45 4L54 14L50 10L50 20L44 20L44 10L45 4Z"
        fill="url(#mm-logo-g)"
      />
    </svg>
  )
}
