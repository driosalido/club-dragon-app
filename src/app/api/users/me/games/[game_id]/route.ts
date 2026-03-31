import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const UpdateGameSchema = z.object({
  interest_level: z.enum(['want_to_play', 'own_and_teach', 'learning']).optional(),
  notes: z.string().max(500).nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ game_id: string }> }
) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { game_id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateGameSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('user_games')
    .update(parsed.data)
    .eq('user_id', user.sub)
    .eq('game_id', game_id)
    .select()
    .single()

  if (error || !data) {
    return Response.json({ error: 'Not found or update failed' }, { status: 404 })
  }

  return Response.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ game_id: string }> }
) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { game_id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('user_games')
    .delete()
    .eq('user_id', user.sub)
    .eq('game_id', game_id)

  if (error) {
    return Response.json({ error: 'Delete failed' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
