import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const LogSessionSchema = z.object({
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration_minutes: z.number().int().positive().optional(),
  state_after_session: z.string().max(2000).optional(),
  next_turn_info: z.string().max(500).optional(),
  linked_session_id: z.string().uuid().optional(),
}).refine(
  (d) => new Date(d.session_date) <= new Date(),
  { message: 'session_date cannot be in the future', path: ['session_date'] }
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('stored_game_sessions')
    .select('*')
    .eq('stored_game_id', id)
    .order('session_date', { ascending: false })

  if (error) return Response.json({ error: 'Query failed' }, { status: 500 })

  return Response.json(data ?? [])
}

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

  // Verify user is a player
  const { data: playerRow } = await supabase
    .from('stored_game_players')
    .select('user_id')
    .eq('stored_game_id', id)
    .eq('user_id', user.sub)
    .single()

  if (!playerRow) {
    return Response.json({ error: 'Only players can log sessions', code: 'NOT_A_PLAYER' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = LogSessionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.issues }, { status: 400 })
  }

  const { data: session, error } = await supabase
    .from('stored_game_sessions')
    .insert({
      stored_game_id: id,
      logged_by: user.sub,
      session_date: parsed.data.session_date,
      duration_minutes: parsed.data.duration_minutes ?? null,
      state_after_session: parsed.data.state_after_session ?? null,
      next_turn_info: parsed.data.next_turn_info ?? null,
      linked_session_id: parsed.data.linked_session_id ?? null,
    })
    .select()
    .single()

  if (error || !session) {
    return Response.json({ error: 'Insert failed' }, { status: 500 })
  }

  // Fetch updated stored_game (trigger should have updated last_session_at and status)
  const { data: updatedGame } = await supabase
    .from('stored_games')
    .select('*')
    .eq('id', id)
    .single()

  return Response.json({ session, stored_game: updatedGame }, { status: 201 })
}
