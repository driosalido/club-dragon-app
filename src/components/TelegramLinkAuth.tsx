'use client'

import { useEffect, useState } from 'react'

interface Props {
  botUsername: string
  onError?: (message: string) => void
}

interface StartResponse {
  token: string
  deepLink: string
  appDeepLink?: string
  expiresAt: string
}

interface StatusResponse {
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed'
}

const POLL_MS = 2000

export default function TelegramLinkAuth({ botUsername, onError }: Props) {
  const [loginToken, setLoginToken] = useState<string | null>(null)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [appDeepLink, setAppDeepLink] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const fallbackBotLink = `https://t.me/${botUsername}`

  async function startLogin() {
    setIsStarting(true)
    try {
      const res = await fetch('/api/auth/telegram-link/start', { method: 'POST' })
      if (!res.ok) {
        onError?.('No se pudo iniciar la validacion con Telegram.')
        return
      }

      const body = await res.json() as StartResponse
      setLoginToken(body.token)
      setDeepLink(body.deepLink)
      setAppDeepLink(body.appDeepLink ?? null)
      setExpiresAt(new Date(body.expiresAt).getTime())
      setIsWaiting(true)
    } catch {
      onError?.('Error de conexion al iniciar la validacion con Telegram.')
    } finally {
      setIsStarting(false)
    }
  }

  useEffect(() => {
    if (loginToken) return
    const tokenFromUrl = new URLSearchParams(window.location.search).get('telegram_link_token')
    if (!tokenFromUrl) return
    setLoginToken(tokenFromUrl)
    setIsWaiting(true)
  }, [loginToken])

  useEffect(() => {
    if (!loginToken || !isWaiting) return

    let stopped = false

    const checkStatus = async () => {
      if (stopped) return
      if (expiresAt && Date.now() > expiresAt) {
        stopped = true
        window.clearInterval(timer)
        setIsWaiting(false)
        onError?.('La solicitud ha expirado. Vuelve a intentarlo.')
        return
      }

      const res = await fetch(`/api/auth/telegram-link/status?token=${encodeURIComponent(loginToken)}`)
      if (!res.ok) return

      const body = await res.json() as StatusResponse
      if (body.status === 'pending') return

      stopped = true
      window.clearInterval(timer)
      setIsWaiting(false)

      if (body.status === 'approved') {
        window.location.assign('/tableros')
        return
      }

      if (body.status === 'expired') {
        onError?.('La solicitud ha expirado. Vuelve a intentarlo.')
      } else if (body.status === 'consumed') {
        onError?.('Este enlace ya fue utilizado. Inicia una nueva validacion.')
      } else {
        onError?.('No se pudo completar la validacion con Telegram.')
      }
    }

    const timer = window.setInterval(checkStatus, POLL_MS)
    void checkStatus()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkStatus()
    }
    const onFocus = () => { void checkStatus() }
    const onPageShow = () => { void checkStatus() }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [expiresAt, isWaiting, loginToken, onError])

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={startLogin}
        disabled={isStarting || isWaiting}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-medium transition-colors"
      >
        {isStarting
          ? 'Iniciando...'
          : isWaiting
            ? 'Esperando confirmacion en Telegram...'
            : 'Entrar desde navegador (confirmando en Telegram)'}
      </button>

      {isWaiting && (appDeepLink || deepLink) && (
        <a
          href={appDeepLink ?? deepLink ?? fallbackBotLink}
          className="text-sm text-indigo-200 bg-indigo-950 border border-indigo-800 rounded-lg px-3 py-2 hover:bg-indigo-900"
        >
          Abrir Telegram para confirmar
        </a>
      )}

      {isWaiting && deepLink && (
        <a
          href={deepLink}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-indigo-300 hover:text-indigo-200 underline"
        >
          Si no se abre, usar enlace web de Telegram
        </a>
      )}

      {isWaiting && !deepLink && (
        <a
          href={fallbackBotLink}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-indigo-300 hover:text-indigo-200 underline"
        >
          Abrir bot en Telegram
        </a>
      )}

      <p className="text-xs text-slate-500 text-center">
        Pulsa el boton para abrir Telegram y confirmar. Luego vuelve manualmente a esta misma pestana de Safari para completar el acceso.
      </p>
    </div>
  )
}
