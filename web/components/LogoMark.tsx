import Image from 'next/image'

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/logo.svg"
      alt="Magic Media"
      width={size}
      height={size}
      priority
    />
  )
}
