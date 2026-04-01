import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let caller
  try {
    caller = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: mfr } = await supabase
    .from('mesa_fija_requests')
    .select('id, requester_id, status, queue_position, slot_id')
    .eq('id', id)
    .single()

  if (!mfr) return Response.json({ error: 'Not found' }, { status: 404 })

  // Only the requester (or admin) can cancel
  const { data: callerData } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', caller.sub)
    .single()

  if (mfr.requester_id !== caller.sub && !callerData?.is_admin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!['pending', 'queued'].includes(mfr.status ?? '')) {
    return Response.json({ error: 'Cannot cancel a request in this state', code: 'INVALID_STATUS' }, { status: 409 })
  }

  // Cancel the request
  const { error: cancelError } = await supabase
    .from('mesa_fija_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (cancelError) return Response.json({ error: 'Update failed' }, { status: 500 })

  // Recompute queue positions only if request was already in queue
  if (mfr.status === 'queued') {
    const posQuery = supabase
      .from('mesa_fija_requests')
      .select('id, queue_position')
      .eq('status', 'queued')
      .gt('queue_position', mfr.queue_position)
      .order('queue_position', { ascending: true })

    if (mfr.slot_id) {
      posQuery.eq('slot_id', mfr.slot_id)
    } else {
      posQuery.is('slot_id', null)
    }

    const { data: toShift } = await posQuery

    for (const row of toShift ?? []) {
      await supabase
        .from('mesa_fija_requests')
        .update({ queue_position: row.queue_position - 1 })
        .eq('id', row.id)
    }
  }

  return Response.json({ ok: true })
}
