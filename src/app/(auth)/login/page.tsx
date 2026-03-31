'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Script from 'next/script'
import TelegramMiniAppAuth from '@/components/TelegramMiniAppAuth'
import TelegramLinkAuth from '@/components/TelegramLinkAuth'
import PoweredByBGG from '@/components/PoweredByBGG'

export default function LoginPage() {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'ClubDragonBot'
  const [error, setError] = useState<string | null>(null)
  const [isMiniApp, setIsMiniApp] = useState<boolean | null>(null)

  // Detect Mini App context after the Telegram Web App script loads
  function handleScriptLoad() {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
    setIsMiniApp(!!(tg?.initData && tg.initData.length > 0))
  }

  // Fallback: if script doesn't load (e.g. network error), show widget
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isMiniApp === null) setIsMiniApp(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [isMiniApp])

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
        onError={() => setIsMiniApp(false)}
      />

      <main className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="bg-slate-900 rounded-2xl p-10 flex flex-col items-center gap-6 shadow-xl border border-slate-800 max-w-sm w-full mx-4">
          <div className="flex flex-col items-center gap-2">
            <Image src="/logo.jpg" alt="Club Dragón Madrid" width={80} height={80} className="rounded-full" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Club Dragón Madrid</h1>
            <p className="text-slate-400 text-sm text-center">
              Accede con tu cuenta de Telegram para gestionar partidas y tableros almacenados.
            </p>
          </div>

          {isMiniApp === null && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {isMiniApp === true && (
            <TelegramMiniAppAuth onError={setError} />
          )}

          {isMiniApp === false && (
            <div className="flex flex-col items-center gap-4 w-full">
              <TelegramLinkAuth
                botUsername={botUsername}
                onError={setError}
              />
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-xs text-slate-600">o</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>
              <a
                href={`https://t.me/${botUsername}/app`}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl py-3 text-sm font-medium transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.008 9.456c-.148.66-.537.819-1.084.51l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.54 14.425l-2.95-.924c-.64-.203-.654-.64.136-.948l11.527-4.448c.533-.194 1.003.126.309.143z"/>
                </svg>
                Abrir con Telegram Desktop
              </a>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-950/40 border border-red-900 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <p className="text-xs text-slate-600 text-center">
            Solo para socios del Club Dragón Madrid
          </p>

          <PoweredByBGG />
        </div>
      </main>
    </>
  )
}
