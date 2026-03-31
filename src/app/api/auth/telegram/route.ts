import { z } from 'zod'
import { SignJWT } from 'jose'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyTelegramHash, isAuthDateValid } from '@/lib/telegram/verify'

const TelegramAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = TelegramAuthSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid payload', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const data = parsed.data
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    return Response.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (!verifyTelegramHash(data, botToken)) {
    return Response.json(
      { error: 'Invalid Telegram signature', code: 'INVALID_HASH' },
      { status: 401 }
    )
  }

  if (!isAuthDateValid(data.auth_date)) {
    return Response.json(
      { error: 'Auth data expired', code: 'AUTH_DATE_EXPIRED' },
      { status: 401 }
    )
  }

  const supabase = createServiceClient()

  const displayName = [data.first_name, data.last_name].filter(Boolean).join(' ')

  const { data: user, error } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: data.id,
        telegram_username: data.username ?? null,
        display_name: displayName,
        avatar_url: data.photo_url ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_id' }
    )
    .select()
    .single()

  if (error || !user) {
    return Response.json(
      { error: 'Database error', code: 'DB_ERROR' },
      { status: 500 }
    )
  }

  const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'placeholder-secret')
  const token = await new SignJWT({ sub: user.id, telegram_id: data.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(jwtSecret)

  return Response.json({ token, user })
}
