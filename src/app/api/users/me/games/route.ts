import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const AddGameSchema = z.object({
  game_id: z.string().uuid(),
  interest_level: z.enum(['want_to_play', 'own_and_teach', 'learning']),
  notes: z.string().max(500).optional(),
})

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('user_games')
    .select('interest_level, notes, created_at, games(id, name, category, thumbnail_url, min_players, max_players, avg_duration_min, bgg_id)')
    .eq('user_id', user.sub)

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

  const parsed = AddGameSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Check if game exists
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('id', parsed.data.game_id)
    .single()

  if (!game) {
    return Response.json({ error: 'Game not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('user_games')
    .upsert(
      {
        user_id: user.sub,
        game_id: parsed.data.game_id,
        interest_level: parsed.data.interest_level,
        notes: parsed.data.notes ?? null,
      },
      { onConflict: 'user_id,game_id' }
    )
    .select()
    .single()

  if (error || !data) {
    return Response.json({ error: 'Insert failed' }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
