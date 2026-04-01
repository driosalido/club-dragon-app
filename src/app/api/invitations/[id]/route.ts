import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import {
  sendGuestInvitationApprovedNotification,
  sendGuestInvitationRejectedNotification,
} from '@/lib/telegram/bot'

const FREE_INVITATIONS_PER_YEAR = 2

const ReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  admin_notes: z.string().max(1000).optional(),
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
    .from('guest_invitations')
    .select('*, inviter:users!inviter_id(id, display_name, avatar_url, telegram_id, telegram_username)')
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
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const reviewParsed = ReviewSchema.safeParse(body)
  if (!reviewParsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { data: invitation } = await supabase
    .from('guest_invitations')
    .select('*')
    .eq('id', id)
    .single()

  if (!invitation) return Response.json({ error: 'Not found' }, { status: 404 })

  if (invitation.status !== 'pending') {
    return Response.json({ error: 'La invitación no está en estado pendiente', code: 'INVALID_STATUS' }, { status: 409 })
  }

  const { status, admin_notes } = reviewParsed.data

  let is_paid = invitation.is_paid

  if (status === 'approved') {
    // Re-compute is_paid based on current approved+used count to prevent gaming the system
    const visitYear = parseInt(invitation.visit_date.slice(0, 4))
    const { count } = await supabase
      .from('guest_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('inviter_id', invitation.inviter_id)
      .in('status', ['approved', 'used'])
      .neq('id', id)
      .gte('visit_date', `${visitYear}-01-01`)
      .lte('visit_date', `${visitYear}-12-31`)

    is_paid = (count ?? 0) >= FREE_INVITATIONS_PER_YEAR
  }

  const { data: updated, error: updateError } = await supabase
    .from('guest_invitations')
    .update({
      status,
      is_paid,
      reviewed_by: caller.sub,
      reviewed_at: new Date().toISOString(),
      admin_notes: admin_notes ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updated) {
    return Response.json({ error: 'Update failed' }, { status: 500 })
  }

  // Notify inviter (fire-and-forget)
  try {
    const { data: inviter } = await supabase
      .from('users')
      .select('telegram_id, display_name')
      .eq('id', invitation.inviter_id)
      .single()

    if (inviter) {
      if (status === 'approved') {
        await sendGuestInvitationApprovedNotification(
          inviter,
          invitation.guest_name,
          invitation.visit_date,
          is_paid
        )
      } else {
        await sendGuestInvitationRejectedNotification(
          inviter,
          invitation.guest_name,
          admin_notes ?? null
        )
      }
    }
  } catch (e) {
    console.error('[invitations] Failed to notify inviter:', e)
  }

  return Response.json(updated)
}
