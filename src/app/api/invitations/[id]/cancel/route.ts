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

  const { data: invitation } = await supabase
    .from('guest_invitations')
    .select('*')
    .eq('id', id)
    .single()

  if (!invitation) return Response.json({ error: 'Not found' }, { status: 404 })

  // Only inviter or admin can cancel
  const { data: callerData } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', caller.sub)
    .single()

  const isAdmin = !!callerData?.is_admin

  if (!isAdmin && invitation.inviter_id !== caller.sub) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!['pending', 'approved'].includes(invitation.status)) {
    return Response.json(
      { error: 'No se puede cancelar una invitación en este estado', code: 'INVALID_STATUS' },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('guest_invitations')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) return Response.json({ error: 'Update failed' }, { status: 500 })

  return Response.json({ ok: true })
}
