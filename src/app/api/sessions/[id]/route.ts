import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendCancelledNotification } from '@/lib/telegram/bot'

const PatchSessionSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  location_details: z.string().max(500).optional(),
  scheduled_time_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  scheduled_time_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: z.enum(['cancelled', 'completed']).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: session, error } = await supabase
    .from('sessions')
    .select(`
      *,
      games(id, name, category, thumbnail_url, min_players, max_players, avg_duration_min),
      users!host_user_id(id, display_name, avatar_url, telegram_username),
      session_participants(
        status,
        joined_at,
        users(id, display_name, avatar_url, telegram_username)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !session) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  return Response.json(session)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  // Verify host
  const { data: session } = await supabase
    .from('sessions')
    .select('host_user_id, status, game_id')
    .eq('id', id)
    .single()

  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })
  if (session.host_user_id !== user.sub) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSessionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('sessions')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error || !updated) {
    return Response.json({ error: 'Update failed' }, { status: 500 })
  }

  // Notify participants if cancelled
  if (parsed.data.status === 'cancelled') {
    const { data: participantRows } = await supabase
      .from('session_participants')
      .select('user_id')
      .eq('session_id', id)
      .neq('user_id', user.sub)

    const participantIds = (participantRows ?? []).map((p) => p.user_id)

    if (participantIds.length > 0) {
      const { data: participantUsers } = await supabase
        .from('users')
        .select('*')
        .in('id', participantIds)

      const { data: gameData } = await supabase.from('games').select('*').eq('id', session.game_id ?? '').single()

      if (participantUsers && participantUsers.length > 0) {
        sendCancelledNotification(
          participantUsers,
          updated,
          gameData ?? null
        ).catch((e) => console.error('Telegram cancel notify error:', e))
      }
    }
  }

  return Response.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Delegate to PATCH with status=cancelled
  const { id } = await params
  const cancelRequest = new Request(request.url, {
    method: 'PATCH',
    headers: request.headers,
    body: JSON.stringify({ status: 'cancelled' }),
  })
  return PATCH(cancelRequest as NextRequest, { params: Promise.resolve({ id }) })
}
