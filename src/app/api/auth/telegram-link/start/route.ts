import { randomBytes } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

const LOGIN_TTL_MS = 5 * 60 * 1000

function createLoginToken(): string {
  return randomBytes(24).toString('base64url')
}

export async function POST() {
  const botUsername =
    process.env.TELEGRAM_BOT_USERNAME ?? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  if (!botUsername) {
    return Response.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const token = createLoginToken()
  const expiresAt = new Date(Date.now() + LOGIN_TTL_MS).toISOString()

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('telegram_login_requests')
    .insert({
      token,
      status: 'pending',
      expires_at: expiresAt,
    })

  if (error) {
    console.error('[auth] telegram-link start failed:', error)
    return Response.json({ error: 'Could not start login flow' }, { status: 500 })
  }

  const deepLink = `https://t.me/${botUsername}?start=login_${token}`
  const appDeepLink = `tg://resolve?domain=${encodeURIComponent(botUsername)}&start=${encodeURIComponent(`login_${token}`)}`
  return Response.json({ token, deepLink, appDeepLink, expiresAt })
}
