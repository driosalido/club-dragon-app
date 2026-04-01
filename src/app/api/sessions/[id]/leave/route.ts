import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { recalculateSessionStatus } from '@/lib/matching/session-status'

export async function DELETE(
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
    .select('status, min_players, max_players, host_user_id, game_id')
    .eq('id', id)
    .single()

  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })

  const { error } = await supabase
    .from('session_participants')
    .delete()
    .eq('session_id', id)
    .eq('user_id', user.sub)

  if (error) return Response.json({ error: 'Leave failed' }, { status: 500 })

  // Promote first waitlisted participant to confirmed
  const { data: waitlisted } = await supabase
    .from('session_participants')
    .select('user_id')
    .eq('session_id', id)
    .eq('status', 'waitlist')
    .order('joined_at', { ascending: true })
    .limit(1)

  if (waitlisted && waitlisted.length > 0) {
    await supabase
      .from('session_participants')
      .update({ status: 'confirmed' })
      .eq('session_id', id)
      .eq('user_id', waitlisted[0].user_id)
  }

  // Recalculate session status
  await recalculateSessionStatus(id, session.min_players, session.max_players, session.host_user_id!, session.game_id)

  return new Response(null, { status: 204 })
}
