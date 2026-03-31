'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  onError?: (message: string) => void
}

export default function TelegramMiniAppAuth({ onError }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string; ready?: () => void } } }).Telegram?.WebApp
    if (!tg?.initData) {
      setStatus('error')
      onError?.('No se pudo obtener los datos de Telegram.')
      return
    }

    tg.ready?.()

    fetch('/api/auth/telegram-miniapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
    })
      .then(async (res) => {
        if (res.ok) {
          const { token } = await res.json() as { token: string }
          document.cookie = `auth-token=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
          router.push('/tableros')
        } else {
          const body = await res.json().catch(() => ({})) as { code?: string }
          if (body.code === 'NOT_A_MEMBER') {
            onError?.('Solo pueden acceder miembros del grupo "Club Dragon Oficial" en Telegram.')
          } else {
            onError?.('Error al autenticar. Inténtalo de nuevo.')
          }
          setStatus('error')
        }
      })
      .catch(() => {
        onError?.('Error de conexión. Inténtalo de nuevo.')
        setStatus('error')
      })
  }, [router, onError])

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Autenticando con Telegram...</p>
      </div>
    )
  }

  return null
}
