'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface Props {
  botUsername: string
  onError?: (message: string) => void
}

export default function TelegramLoginButton({ botUsername, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const callbackName = '__telegramLoginCallback'

    ;(window as unknown as Record<string, unknown>)[callbackName] = async (user: TelegramUser) => {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      })

      if (res.ok) {
        await res.json()
        router.push('/tableros')
      } else {
        const body = await res.json().catch(() => ({})) as { code?: string }
        if (body.code === 'NOT_A_MEMBER') {
          onError?.('Solo pueden acceder miembros del grupo "Club Dragon Oficial" en Telegram.')
        } else {
          onError?.('Error al autenticar. Inténtalo de nuevo.')
        }
      }
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', `${callbackName}(user)`)
    // data-request-access: 'write' removed — it silently blocks login for users who haven't started the bot
    script.async = true

    if (containerRef.current) {
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(script)
    }

    return () => {
      delete (window as unknown as Record<string, unknown>)[callbackName]
    }
  }, [botUsername, router])

  return <div ref={containerRef} className="flex justify-center" />
}
