import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  let caller
  try {
    caller = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const typeFilter = searchParams.get('type') as 'pizzero' | 'mesa_fija' | null

  const supabase = createServiceClient()

  // Get all slots
  let slotsQuery = supabase
    .from('storage_slots')
    .select('*')
    .order('slot_number', { ascending: true })

  if (typeFilter) {
    slotsQuery = slotsQuery.eq('slot_type', typeFilter)
  }

  const { data: slots, error: slotsError } = await slotsQuery

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

  // Get queue counts for mesa_fija slots
  const { data: queueCounts } = await supabase
    .from('mesa_fija_requests')
    .select('slot_id, id, status, game_id, expires_at, queue_position')
    .in('status', ['queued', 'approved'])

  const queueCountMap = new Map<string, number>()
  for (const r of queueCounts ?? []) {
    if (r.slot_id) {
      queueCountMap.set(r.slot_id, (queueCountMap.get(r.slot_id) ?? 0) + 1)
    }
  }

  // Get current user's active requests for mesa_fija slots
  const { data: myRequests } = await supabase
    .from('mesa_fija_requests')
    .select('id, slot_id, status, game_id, expires_at, queue_position')
    .eq('requester_id', caller.sub)
    .in('status', ['queued', 'approved'])

  // Build game name map for my requests
  const myRequestGameIds = (myRequests ?? []).map((r) => r.game_id).filter(Boolean) as string[]
  const { data: myRequestGames } = myRequestGameIds.length > 0
    ? await supabase.from('games').select('id, name').in('id', myRequestGameIds)
    : { data: [] }
  const myRequestGameMap = new Map((myRequestGames ?? []).map((g) => [g.id, g.name]))

  const myRequestMap = new Map<string, {
    id: string
    status: 'queued' | 'approved'
    game_id: string | null
    game_name: string | null
    expires_at: string | null
    queue_position: number
  }>()
  for (const r of myRequests ?? []) {
    if (r.slot_id) {
      myRequestMap.set(r.slot_id, {
        id: r.id,
        status: r.status as 'queued' | 'approved',
        game_id: r.game_id,
        game_name: r.game_id ? (myRequestGameMap.get(r.game_id) ?? null) : null,
        expires_at: r.expires_at,
        queue_position: r.queue_position,
      })
    }
  }

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
    const myRequest = myRequestMap.get(slot.id) ?? null
    const queue_count = queueCountMap.get(slot.id) ?? 0

    if (!activeGame) {
      return { ...slot, occupied: false, stored_game: null, queue_count, my_request: myRequest }
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
      queue_count,
      my_request: myRequest,
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
