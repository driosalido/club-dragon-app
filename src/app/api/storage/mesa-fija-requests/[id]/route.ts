import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import storageConfig from '@/config/storage'
import {
  sendMesaFijaApprovedNotification,
  sendMesaFijaRejectedNotification,
} from '@/lib/telegram/bot'

const ReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  admin_notes: z.string().max(1000).optional(),
  slot_id: z.string().uuid().optional(), // assign specific slot on approval
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

  // Admin check
  const { data: callerData } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', caller.sub)
    .single()

  if (!callerData?.is_admin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ReviewSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error' }, { status: 400 })
  }

  // Fetch current request
  const { data: mfr } = await supabase
    .from('mesa_fija_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (!mfr) return Response.json({ error: 'Not found' }, { status: 404 })
  if (mfr.status !== 'queued') {
    return Response.json({ error: 'Request is not in queued status', code: 'INVALID_STATUS' }, { status: 409 })
  }

  const updateData: Record<string, unknown> = {
    status: parsed.data.status,
    reviewed_by: caller.sub,
    reviewed_at: new Date().toISOString(),
    admin_notes: parsed.data.admin_notes ?? null,
  }

  if (parsed.data.status === 'approved') {
    // Enforce only one approved request per slot at a time
    const slotId = parsed.data.slot_id ?? mfr.slot_id
    if (slotId) {
      const { data: existingApproved } = await supabase
        .from('mesa_fija_requests')
        .select('id')
        .eq('slot_id', slotId)
        .eq('status', 'approved')
        .neq('id', id)
        .limit(1)
        .maybeSingle()

      if (existingApproved) {
        return Response.json(
          { error: 'Ya hay una solicitud aprobada para esta mesa. Debe expirar o ser rechazada primero.', code: 'ALREADY_APPROVED' },
          { status: 409 }
        )
      }
    }

    updateData.expires_at = new Date(Date.now() + storageConfig.mesaFijaApprovalHours * 60 * 60 * 1000).toISOString()
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
      if (parsed.data.status === 'approved') {
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
