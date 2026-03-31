import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const CreateGameSchema = z.object({
  name: z.string().min(1).max(200),
  bgg_id: z.number().int().positive().optional(),
  category: z.enum(['wargame_tablero', 'wargame_figuras', 'euros', 'rol', 'abstracto', 'familiar']).optional(),
  min_players: z.number().int().positive().optional(),
  max_players: z.number().int().positive().optional(),
  avg_duration_min: z.number().int().positive().optional(),
  thumbnail_url: z.string().url().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')
  const category = searchParams.get('category')

  const supabase = createServiceClient()

  let query = supabase.from('games').select('*').limit(20)

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }
  if (category) {
    query = query.eq('category', category as 'wargame_tablero' | 'wargame_figuras' | 'euros' | 'rol' | 'abstracto' | 'familiar')
  }

  query = query.order('name')

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

  const parsed = CreateGameSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // If bgg_id provided, check for existing game
  if (parsed.data.bgg_id) {
    const { data: existing } = await supabase
      .from('games')
      .select('*')
      .eq('bgg_id', parsed.data.bgg_id)
      .single()

    if (existing) {
      return Response.json(existing)
    }
  }

  const { data, error } = await supabase
    .from('games')
    .insert({ ...parsed.data, added_by: user.sub })
    .select()
    .single()

  if (error || !data) {
    return Response.json({ error: 'Insert failed' }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
