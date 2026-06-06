export function LogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="mm-g" x1="0" y1="0" x2="90" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D" />
          <stop offset="0.45" stopColor="#FB923C" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
      </defs>

      {/*
        Solid M shape:
        Outer shell → inner cutout creates letter shape.
        Left bar: x 4–18, Right bar: x 72–86
        Left peak: y~6, Right peak: y~6
        Center valley outer: y~52, inner: y~64
        Arrow on top-right: extends above right peak
      */}
      <path
        fillRule="evenodd"
        d="
          M4,90
          L4,20 L14,6 L45,52 L76,6
          L72,2 L80,0 L90,10 L86,14
          L86,90 L72,90 L72,30 L45,66 L18,30 L18,90
          Z
        "
        fill="url(#mm-g)"
      />
    </svg>
  )
}
