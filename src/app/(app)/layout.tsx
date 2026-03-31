import type { ReactNode } from 'react'
import Image from 'next/image'
import BottomNav from '@/components/BottomNav'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center gap-3">
        <Image src="/logo.jpg" alt="Club Dragón Madrid" width={36} height={36} className="rounded-full" />
        <h1 className="text-lg font-semibold tracking-tight">Club Dragón</h1>
      </header>

      <main className="flex-1 pb-20">
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
