import { z } from 'zod'
import { SignJWT } from 'jose'
import { createServiceClient } from '@/lib/supabase/server'
import { buildAuthCookie } from '@/lib/auth-cookie'

const QuerySchema = z.object({
  token: z.string().min(20),
})

function buildPublicTelegramAvatar(username?: string | null): string | null {
  if (!username) return null
  return `https://t.me/i/userpic/320/${encodeURIComponent(username)}.jpg`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({ token: url.searchParams.get('token') })
  if (!parsed.success) {
    return Response.json({ error: 'Missing token' }, { status: 400 })
  }

  const token = parsed.data.token
  const supabase = createServiceClient()

  const { data: loginRequest, error } = await supabase
    .from('telegram_login_requests')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !loginRequest) {
    return Response.json({ error: 'Login request not found' }, { status: 404 })
  }

  const isExpired = new Date(loginRequest.expires_at).getTime() < Date.now()
  if (isExpired && loginRequest.status === 'pending') {
    await supabase
      .from('telegram_login_requests')
      .update({ status: 'rejected' })
      .eq('token', token)
      .eq('status', 'pending')
    return Response.json({ status: 'expired' })
  }

  if (loginRequest.status === 'pending') {
    return Response.json({ status: 'pending' })
  }

  if (loginRequest.status === 'rejected') {
    return Response.json({ status: isExpired ? 'expired' : 'rejected' })
  }

  if (loginRequest.status === 'consumed') {
    // Keep consumed requests recoverable: if the browser missed one poll response,
    // returning the token again avoids leaving the user stuck after Telegram confirmation.
    if (!loginRequest.telegram_id || !loginRequest.telegram_first_name) {
      return Response.json({ status: 'consumed' })
    }
  }

  if (!loginRequest.telegram_id || !loginRequest.telegram_first_name) {
    return Response.json({ error: 'Invalid login state' }, { status: 500 })
  }

  const displayName = [
    loginRequest.telegram_first_name,
    loginRequest.telegram_last_name,
  ].filter(Boolean).join(' ')

  // Telegram webhook updates do not include profile photo URL.
  // Preserve existing avatar instead of overwriting it with null.
  const { data: existingUser } = await supabase
    .from('users')
    .select('avatar_url')
    .eq('telegram_id', loginRequest.telegram_id)
    .maybeSingle()

  const usernameAvatar = buildPublicTelegramAvatar(loginRequest.telegram_username)
  const existingAvatarIsTokenizedTelegramUrl = !!existingUser?.avatar_url?.includes('/file/bot')
  const safeExistingAvatar = existingAvatarIsTokenizedTelegramUrl ? null : existingUser?.avatar_url ?? null

  const { data: user, error: upsertError } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: loginRequest.telegram_id,
        telegram_username: loginRequest.telegram_username ?? null,
        display_name: displayName,
        avatar_url: loginRequest.telegram_photo_url ?? safeExistingAvatar ?? usernameAvatar ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_id' }
    )
    .select()
    .single()

  if (upsertError || !user) {
    console.error('[auth] telegram-link upsert failed:', upsertError)
    return Response.json({ error: 'Database error', code: 'DB_ERROR' }, { status: 500 })
  }

  const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'placeholder-secret')
  const appToken = await new SignJWT({ sub: user.id, telegram_id: loginRequest.telegram_id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(jwtSecret)

  if (loginRequest.status === 'approved') {
    await supabase
      .from('telegram_login_requests')
      .update({ status: 'consumed', consumed_at: new Date().toISOString() })
      .eq('token', token)
      .eq('status', 'approved')
  }

  return Response.json(
    { status: 'approved', user },
    { headers: { 'Set-Cookie': buildAuthCookie(appToken, request) } }
  )
}
