import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import {
  sendMesaFijaApprovedNotification,
  sendMesaFijaRejectedNotification,
} from '@/lib/telegram/bot'

const ReviewSchema = z.object({
  status: z.enum(['queued', 'rejected']),
  admin_notes: z.string().max(1000).optional(),
  slot_id: z.string().uuid().optional(), // assign specific slot on approval
})

const EditSchema = z.object({
  game_id: z.string().uuid().optional(),
  reason: z.string().max(1000).nullable().optional(),
  expected_duration_months: z.number().int().min(1).max(24).nullable().optional(),
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

  const { data, error } = await supabase
    .from('mesa_fija_requests')
    .select(`
      *,
      requester:users!requester_id(id, display_name, avatar_url, telegram_id),
      game:games!game_id(id, name, category, thumbnail_url),
      slot:storage_slots!slot_id(id, slot_number, label)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

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

  const supabase = createServiceClient()

  // Caller role
  const { data: callerData } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', caller.sub)
    .single()
  const isAdmin = !!callerData?.is_admin

  const { id } = await params

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Fetch current request
  const { data: mfr } = await supabase
    .from('mesa_fija_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (!mfr) return Response.json({ error: 'Not found' }, { status: 404 })

  const reviewParsed = ReviewSchema.safeParse(body)
  if (reviewParsed.success) {
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (mfr.status !== 'pending') {
      return Response.json({ error: 'Request is not in pending status', code: 'INVALID_STATUS' }, { status: 409 })
    }

    const parsed = reviewParsed
    const updateData: Record<string, unknown> = {
      status: parsed.data.status,
      reviewed_by: caller.sub,
      reviewed_at: new Date().toISOString(),
      admin_notes: parsed.data.admin_notes ?? null,
    }

    if (parsed.data.status === 'queued') {
      // On approval, assign queue position for this slot.
      const slotId = parsed.data.slot_id ?? mfr.slot_id
      if (slotId) {
        const { data: lastPos } = await supabase
          .from('mesa_fija_requests')
          .select('queue_position')
          .eq('slot_id', slotId)
          .eq('status', 'queued')
          .neq('id', id)
          .order('queue_position', { ascending: false })
          .limit(1)

        updateData.queue_position = lastPos && lastPos.length > 0 ? (lastPos[0]!.queue_position + 1) : 1
      }

      if (parsed.data.slot_id) {
        updateData.slot_id = parsed.data.slot_id
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('mesa_fija_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError || !updated) {
      return Response.json({ error: 'Update failed' }, { status: 500 })
    }

    // Notify requester
    try {
      const { data: requester } = await supabase
        .from('users')
        .select('telegram_id, display_name')
        .eq('id', mfr.requester_id)
        .single()
      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('id', mfr.game_id)
        .single()
      if (requester) {
        if (parsed.data.status === 'queued') {
          await sendMesaFijaApprovedNotification(requester, updated, gameData ?? null)
        } else {
          await sendMesaFijaRejectedNotification(requester, updated, gameData ?? null, parsed.data.admin_notes ?? null)
        }
      }
    } catch (e) {
      console.error('[mesa_fija] Failed to notify requester:', e)
    }

    return Response.json(updated)
  }

  const editParsed = EditSchema.safeParse(body)
  if (!editParsed.success) {
    return Response.json({ error: 'Validation error' }, { status: 400 })
  }

  if (!isAdmin && mfr.requester_id !== caller.sub) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!['pending', 'queued'].includes(mfr.status)) {
    return Response.json({ error: 'Cannot edit request in this status', code: 'INVALID_STATUS' }, { status: 409 })
  }

  const updateData: Record<string, unknown> = {}
  if (editParsed.data.game_id !== undefined) updateData.game_id = editParsed.data.game_id
  if (editParsed.data.reason !== undefined) updateData.reason = editParsed.data.reason
  if (editParsed.data.expected_duration_months !== undefined) {
    updateData.expected_duration_months = editParsed.data.expected_duration_months
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('mesa_fija_requests')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updated) {
    return Response.json({ error: 'Update failed' }, { status: 500 })
  }

  return Response.json(updated)
}
