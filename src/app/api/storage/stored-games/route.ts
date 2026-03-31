import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const CreateStoredGameSchema = z.object({
  slot_id: z.string().uuid(),
  game_id: z.string().uuid(),
  players: z.array(z.object({
    user_id: z.string().uuid(),
    faction_or_side: z.string().max(100).optional(),
  })).min(1),
  scenario_notes: z.string().max(2000).optional(),
  expected_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const game_id = searchParams.get('game_id')
  const player_id = searchParams.get('player_id')

  const supabase = createServiceClient()

  let query = supabase
    .from('stored_games')
    .select('*, games(id, name, category, thumbnail_url), storage_slots(id, slot_number, label)')
    .order('last_session_at', { ascending: true })

  if (status) {
    query = query.eq('status', status as 'active' | 'warning' | 'critical' | 'expired' | 'completed' | 'evicted')
  } else {
    query = query.in('status', ['active', 'warning', 'critical', 'expired'])
  }
  if (game_id) query = query.eq('game_id', game_id)

  const { data, error } = await query
  if (error) return Response.json({ error: 'Query failed' }, { status: 500 })

  let results = data ?? []

  // Filter by player if needed
  if (player_id) {
    const { data: playerGames } = await supabase
      .from('stored_game_players')
      .select('stored_game_id')
      .eq('user_id', player_id)
    const ids = new Set((playerGames ?? []).map((p) => p.stored_game_id))
    results = results.filter((g) => ids.has(g.id))
  }

  // Add players and days_since_last
  const now = new Date()
  const gameIds = results.map((g) => g.id)
  type PlayerRow = { stored_game_id: string; user_id: string; faction_or_side: string | null }
  const { data: allPlayers } = gameIds.length > 0
    ? await supabase.from('stored_game_players').select('stored_game_id, user_id, faction_or_side').in('stored_game_id', gameIds)
    : { data: [] as PlayerRow[] }

  const playersByGame: Record<string, PlayerRow[]> = {}
  for (const p of allPlayers ?? []) {
    if (!playersByGame[p.stored_game_id]) playersByGame[p.stored_game_id] = []
    playersByGame[p.stored_game_id]!.push(p)
  }

  const enriched = results.map((g) => {
    const lastSession = g.last_session_at ? new Date(g.last_session_at) : null
    const days_since_last = lastSession
      ? Math.floor((now.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24))
      : null
    return { ...g, players: playersByGame[g.id] ?? [], days_since_last }
  })

  return Response.json(enriched)
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateStoredGameSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Check slot is free
  const { data: existingGame } = await supabase
    .from('stored_games')
    .select('id')
    .eq('slot_id', parsed.data.slot_id)
    .in('status', ['active', 'warning', 'critical', 'expired'])
    .single()

  if (existingGame) {
    return Response.json({ error: 'Slot is already occupied', code: 'SLOT_OCCUPIED' }, { status: 409 })
  }

  const { data: storedGame, error } = await supabase
    .from('stored_games')
    .insert({
      slot_id: parsed.data.slot_id,
      game_id: parsed.data.game_id,
      registered_by: user.sub,
      status: 'active',
      scenario_notes: parsed.data.scenario_notes ?? null,
      expected_end_date: parsed.data.expected_end_date ?? null,
    })
    .select()
    .single()

  if (error || !storedGame) {
    return Response.json({ error: 'Insert failed' }, { status: 500 })
  }

  // Add players
  const playerRows = parsed.data.players.map((p) => ({
    stored_game_id: storedGame.id,
    user_id: p.user_id,
    faction_or_side: p.faction_or_side ?? null,
  }))

  await supabase.from('stored_game_players').insert(playerRows)

  return Response.json(storedGame, { status: 201 })
}
