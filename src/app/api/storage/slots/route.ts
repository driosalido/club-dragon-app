import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all slots
  const { data: slots, error: slotsError } = await supabase
    .from('storage_slots')
    .select('*')
    .order('slot_number', { ascending: true })

  if (slotsError) return Response.json({ error: 'Query failed' }, { status: 500 })

  // Get active stored games for each slot
  const { data: activeGames } = await supabase
    .from('stored_games')
    .select('id, slot_id, game_id, status, last_session_at, scenario_notes, current_state_notes, turn_info, expected_end_date, started_at')
    .in('status', ['active', 'warning', 'critical', 'expired'])

  const { data: gameData } = await supabase
    .from('games')
    .select('id, name, thumbnail_url, category')

  const { data: playerData } = await supabase
    .from('stored_game_players')
    .select('stored_game_id, user_id, faction_or_side, users(id, display_name, avatar_url)')

  const gameMap = new Map((gameData ?? []).map((g) => [g.id, g]))
  const activeGameMap = new Map((activeGames ?? []).map((ag) => [ag.slot_id, ag]))

  // Build player map by stored_game_id
  const playersByGame: Record<string, typeof playerData> = {}
  for (const p of playerData ?? []) {
    if (!playersByGame[p.stored_game_id]) playersByGame[p.stored_game_id] = []
    playersByGame[p.stored_game_id]!.push(p)
  }

  const now = new Date()

  const result = (slots ?? []).map((slot) => {
    const activeGame = activeGameMap.get(slot.id)
    if (!activeGame) {
      return { ...slot, occupied: false, stored_game: null }
    }

    const game = activeGame.game_id ? gameMap.get(activeGame.game_id) : null
    const players = playersByGame[activeGame.id] ?? []
    const lastSession = activeGame.last_session_at ? new Date(activeGame.last_session_at) : null
    const days_since_last = lastSession
      ? Math.floor((now.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24))
      : null

    return {
      ...slot,
      occupied: true,
      stored_game: {
        ...activeGame,
        game,
        players,
        days_since_last,
      },
    }
  })

  return Response.json(result)
}
