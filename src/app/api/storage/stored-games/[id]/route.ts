import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendStorageEvictedNotification } from '@/lib/telegram/bot'

const PatchStoredGameSchema = z.object({
  current_state_notes: z.string().max(2000).optional(),
  turn_info: z.string().max(500).optional(),
  expected_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.literal('evicted').optional(),
})

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

  const { data: storedGame, error } = await supabase
    .from('stored_games')
    .select('*, games(id, name, category, thumbnail_url, min_players, max_players, avg_duration_min), storage_slots(id, slot_number, label, max_board_size)')
    .eq('id', id)
    .single()

  if (error || !storedGame) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: players } = await supabase
    .from('stored_game_players')
    .select('user_id, faction_or_side, joined_at, users(id, display_name, avatar_url)')
    .eq('stored_game_id', id)

  const { data: sessions } = await supabase
    .from('stored_game_sessions')
    .select('*')
    .eq('stored_game_id', id)
    .order('session_date', { ascending: false })

  const now = new Date()
  const lastSession = storedGame.last_session_at ? new Date(storedGame.last_session_at) : null
  const days_since_last = lastSession
    ? Math.floor((now.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return Response.json({ ...storedGame, players: players ?? [], sessions: sessions ?? [], days_since_last })
}

export async function PATCH(
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

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchStoredGameSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Check if user is a player
  const { data: playerRow } = await supabase
    .from('stored_game_players')
    .select('user_id')
    .eq('stored_game_id', id)
    .eq('user_id', user.sub)
    .single()

  // Check if admin (for evicted)
  const { data: userData } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.sub)
    .single()

  const isAdmin = userData?.is_admin ?? false

  if (parsed.data.status === 'evicted' && !isAdmin) {
    return Response.json({ error: 'Only admins can evict a stored game' }, { status: 403 })
  }

  if (!playerRow && !isAdmin) {
    return Response.json({ error: 'Not a player in this game' }, { status: 403 })
  }

  const { data: updated, error } = await supabase
    .from('stored_games')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error || !updated) return Response.json({ error: 'Update failed' }, { status: 500 })

  // Notify if evicted
  if (parsed.data.status === 'evicted') {
    const { data: playerRows } = await supabase
      .from('stored_game_players')
      .select('user_id')
      .eq('stored_game_id', id)

    const playerIds = (playerRows ?? []).map((p) => p.user_id)
    const { data: playerUsers } = await supabase.from('users').select('*').in('id', playerIds)
    const { data: gameData } = await supabase.from('games').select('*').eq('id', updated.game_id ?? '').single()

    if (playerUsers && playerUsers.length > 0) {
      sendStorageEvictedNotification(playerUsers, updated, gameData ?? null)
        .catch((e) => console.error('Telegram evicted notify error:', e))
    }
  }

  return Response.json(updated)
}

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

  // Verify user is a player
  const { data: playerRow } = await supabase
    .from('stored_game_players')
    .select('user_id')
    .eq('stored_game_id', id)
    .eq('user_id', user.sub)
    .single()

  const { data: userData } = await supabase.from('users').select('is_admin').eq('id', user.sub).single()
  if (!playerRow && !userData?.is_admin) {
    return Response.json({ error: 'Not a player in this game' }, { status: 403 })
  }

  const { error } = await supabase
    .from('stored_games')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return Response.json({ error: 'Update failed' }, { status: 500 })

  return new Response(null, { status: 204 })
}
