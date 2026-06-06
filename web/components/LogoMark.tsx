import Image from 'next/image'

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Magic Media"
      width={size}
      height={size}
      priority
      style={{ objectFit: 'contain' }}
    />
  )
}
