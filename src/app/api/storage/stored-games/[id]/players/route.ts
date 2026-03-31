import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const UpdatePlayersSchema = z.object({
  players: z.array(z.object({
    user_id: z.string().uuid(),
    faction_or_side: z.string().max(100).optional(),
  })).min(1),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let caller
  try {
    caller = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdatePlayersSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation error', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const { id: storedGameId } = await params
  const supabase = createServiceClient()

  const { data: storedGame } = await supabase
    .from('stored_games')
    .select('id, responsible_user_id')
    .eq('id', storedGameId)
    .single()

  if (!storedGame) {
    return Response.json({ error: 'Stored game not found' }, { status: 404 })
  }

  const { data: callerUser } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', caller.sub)
    .single()

  const canEditPlayers =
    callerUser?.is_admin === true || storedGame.responsible_user_id === caller.sub
  if (!canEditPlayers) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const uniquePlayers = Array.from(
    new Map(parsed.data.players.map((p) => [p.user_id, p])).values()
  )

  if (
    storedGame.responsible_user_id &&
    !uniquePlayers.some((p) => p.user_id === storedGame.responsible_user_id)
  ) {
    return Response.json(
      { error: 'Responsible user must remain in players list' },
      { status: 400 }
    )
  }

  const { data: currentPlayers } = await supabase
    .from('stored_game_players')
    .select('user_id')
    .eq('stored_game_id', storedGameId)

  const currentUserIds = new Set((currentPlayers ?? []).map((p) => p.user_id))
  const nextUserIds = new Set(uniquePlayers.map((p) => p.user_id))

  const toDelete = Array.from(currentUserIds).filter((u) => !nextUserIds.has(u))
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('stored_game_players')
      .delete()
      .eq('stored_game_id', storedGameId)
      .in('user_id', toDelete)
    if (deleteError) {
      return Response.json({ error: 'Failed to remove players' }, { status: 500 })
    }
  }

  const rows = uniquePlayers.map((p) => ({
    stored_game_id: storedGameId,
    user_id: p.user_id,
    faction_or_side: p.faction_or_side?.trim() ? p.faction_or_side.trim() : null,
  }))

  const { error: upsertError } = await supabase
    .from('stored_game_players')
    .upsert(rows, { onConflict: 'stored_game_id,user_id' })
  if (upsertError) {
    return Response.json({ error: 'Failed to update players' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
