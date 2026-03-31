import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyNewSession } from '@/lib/matching/notify'

const QuerySchema = z.object({
  game_id: z.string().uuid().optional(),
  category: z.enum(['wargame_tablero', 'wargame_figuras', 'euros', 'rol', 'abstracto', 'familiar']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  status: z.string().optional(),
  my_games: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

const CreateSessionSchema = z.object({
  game_id: z.string().uuid(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduled_time_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  scheduled_time_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  location_type: z.enum(['club', 'home', 'online']),
  location_details: z.string().max(500).optional(),
  min_players: z.number().int().min(2),
  max_players: z.number().int().min(2),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  stored_game_id: z.string().uuid().optional(),
}).refine((d) => d.max_players >= d.min_players, {
  message: 'max_players must be >= min_players',
  path: ['max_players'],
}).refine((d) => new Date(d.scheduled_date) >= new Date(new Date().toISOString().slice(0, 10)), {
  message: 'scheduled_date must be in the future',
  path: ['scheduled_date'],
})

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = QuerySchema.safeParse(params)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid query params' }, { status: 400 })
  }

  const { game_id, category, date_from, date_to, status, my_games, limit, offset } = parsed.data
  const supabase = createServiceClient()

  const validStatuses = ['open', 'full', 'confirmed', 'cancelled', 'completed'] as const
  type SessionStatus = typeof validStatuses[number]
  const statuses = (status
    ? status.split(',').filter((s): s is SessionStatus => validStatuses.includes(s as SessionStatus))
    : ['open', 'full', 'confirmed']) as SessionStatus[]

  let query = supabase
    .from('sessions')
    .select(`
      *,
      games(id, name, category, thumbnail_url),
      users!host_user_id(id, display_name, avatar_url),
      session_participants(status)
    `)
    .in('status', statuses)
    .order('scheduled_date', { ascending: true })
    .range(offset, offset + limit - 1)

  if (game_id) query = query.eq('game_id', game_id)
  if (category) query = query.eq('games.category', category)
  if (date_from) query = query.gte('scheduled_date', date_from)
  if (date_to) query = query.lte('scheduled_date', date_to)

  if (my_games === 'true') {
    // Get user's game IDs first
    const { data: userGames } = await supabase
      .from('user_games')
      .select('game_id')
      .eq('user_id', user.sub)

    const gameIds = (userGames ?? []).map((g) => g.game_id)
    if (gameIds.length === 0) return Response.json([])
    query = query.in('game_id', gameIds)
  }

  const { data, error } = await query

  if (error) {
    return Response.json({ error: 'Query failed' }, { status: 500 })
  }

  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateSessionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.issues }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      ...parsed.data,
      host_user_id: user.sub,
      status: 'open',
    })
    .select()
    .single()

  if (error || !session) {
    return Response.json({ error: 'Insert failed' }, { status: 500 })
  }

  // Add host as confirmed participant
  await supabase.from('session_participants').insert({
    session_id: session.id,
    user_id: user.sub,
    status: 'confirmed',
  })

  // Trigger matching notifications async (don't await to avoid blocking)
  notifyNewSession(session.id).catch((err) => console.error('Matching notify error:', err))

  return Response.json(session, { status: 201 })
}
