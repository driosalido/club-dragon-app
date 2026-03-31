import Image from 'next/image'

export default function PoweredByBGG({ className = '' }: { className?: string }) {
  return (
    <a
      href="https://boardgamegeek.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex ${className}`}
    >
      <Image
        src="/powered-by-bgg.webp"
        alt="Powered by BoardGameGeek"
        width={120}
        height={30}
        className="opacity-80 hover:opacity-100 transition-opacity"
      />
    </a>
  )
}
