import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

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

  const { data: user, error } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, bio, telegram_username, created_at')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error || !user) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: games } = await supabase
    .from('user_games')
    .select('interest_level, notes, created_at, games(id, name, category, thumbnail_url)')
    .eq('user_id', id)

  return Response.json({ ...user, games: games ?? [] })
}
