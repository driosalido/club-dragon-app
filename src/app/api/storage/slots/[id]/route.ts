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

  const { data: slot, error } = await supabase
    .from('storage_slots')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !slot) return Response.json({ error: 'Slot not found' }, { status: 404 })

  // Get all stored games that have ever used this slot
  const { data: history } = await supabase
    .from('stored_games')
    .select('*, games(id, name, category, thumbnail_url)')
    .eq('slot_id', id)
    .order('started_at', { ascending: false })

  return Response.json({ ...slot, history: history ?? [] })
}
