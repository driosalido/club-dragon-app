import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { recalculateSessionStatus } from '@/lib/matching/session-status'

const JoinSchema = z.object({
  status: z.enum(['confirmed', 'interested']).default('confirmed'),
})

export async function POST(
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

  const { data: session } = await supabase
    .from('sessions')
    .select('status, max_players, min_players, host_user_id, game_id')
    .eq('id', id)
    .single()

  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })
  if (session.status === 'cancelled' || session.status === 'completed') {
    return Response.json({ error: 'Cannot join a cancelled or completed session', code: 'SESSION_CLOSED' }, { status: 400 })
  }

  let body: unknown = {}
  try { body = await request.json() } catch { /* empty body ok */ }
  const parsed = JoinSchema.safeParse(body)
  const requestedStatus = parsed.success ? parsed.data.status : 'confirmed'

  // Count confirmed participants
  const { data: confirmedParticipants } = await supabase
    .from('session_participants')
    .select('user_id')
    .eq('session_id', id)
    .eq('status', 'confirmed')

  const confirmedCount = confirmedParticipants?.length ?? 0
  const actualStatus = confirmedCount >= session.max_players ? 'waitlist' : requestedStatus

  const { data: participant, error } = await supabase
    .from('session_participants')
    .upsert(
      { session_id: id, user_id: user.sub, status: actualStatus },
      { onConflict: 'session_id,user_id' }
    )
    .select()
    .single()

  if (error || !participant) {
    return Response.json({ error: 'Join failed' }, { status: 500 })
  }

  // Recalculate session status
  await recalculateSessionStatus(id, session.min_players, session.max_players, session.host_user_id, session.game_id)

  return Response.json(participant, { status: 201 })
}
