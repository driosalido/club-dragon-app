import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: playerRows } = await supabase
    .from('stored_game_players')
    .select('stored_game_id')
    .eq('user_id', user.sub)

  const ids = (playerRows ?? []).map((p) => p.stored_game_id)
  if (ids.length === 0) return Response.json([])

  const { data, error } = await supabase
    .from('stored_games')
    .select('*, games(id, name, category, thumbnail_url), storage_slots(id, slot_number, label)')
    .in('id', ids)
    .order('last_session_at', { ascending: true })

  if (error) return Response.json({ error: 'Query failed' }, { status: 500 })

  const now = new Date()
  const enriched = (data ?? []).map((g) => {
    const lastSession = g.last_session_at ? new Date(g.last_session_at) : null
    const days_since_last = lastSession
      ? Math.floor((now.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24))
      : null
    return { ...g, days_since_last }
  })

  return Response.json(enriched)
}
