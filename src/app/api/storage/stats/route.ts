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

  // Only admins
  const { data: userData } = await supabase.from('users').select('is_admin').eq('id', user.sub).single()
  if (!userData?.is_admin) {
    return Response.json({ error: 'Admin only' }, { status: 403 })
  }

  const { data: totalSlots } = await supabase.from('storage_slots').select('id').eq('is_active', true)
  const { data: activeGames } = await supabase
    .from('stored_games')
    .select('id, game_id, status')
    .in('status', ['active', 'warning', 'critical', 'expired'])

  const { data: sessions } = await supabase
    .from('stored_game_sessions')
    .select('duration_minutes, stored_game_id')

  const occupiedSlots = activeGames?.length ?? 0
  const freeSlots = (totalSlots?.length ?? 0) - occupiedSlots

  const avgDuration = sessions && sessions.length > 0
    ? Math.round(sessions.filter((s) => s.duration_minutes).reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) / sessions.filter((s) => s.duration_minutes).length)
    : 0

  // Most stored game
  const gameCount: Record<string, number> = {}
  for (const g of activeGames ?? []) {
    if (g.game_id) gameCount[g.game_id] = (gameCount[g.game_id] ?? 0) + 1
  }
  const topGameId = Object.entries(gameCount).sort(([, a], [, b]) => b - a)[0]?.[0]

  return Response.json({
    total_slots: totalSlots?.length ?? 0,
    occupied_slots: occupiedSlots,
    free_slots: freeSlots,
    avg_session_duration_min: avgDuration,
    most_stored_game_id: topGameId ?? null,
  })
}
