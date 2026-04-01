import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendGuestInvitationRequestNotification } from '@/lib/telegram/bot'

const FREE_INVITATIONS_PER_YEAR = 2

const CreateInvitationSchema = z.object({
  guest_name: z.string().trim().min(2).max(200),
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD'),
})

export async function GET(request: NextRequest) {
  let caller
  try {
    caller = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Check if caller is admin
  const { data: callerData } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', caller.sub)
    .single()
  const isAdmin = !!callerData?.is_admin

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const mine = searchParams.get('mine')
  const year = searchParams.get('year')

  let query = supabase
    .from('guest_invitations')
    .select('*')
    .order('created_at', { ascending: false })

  // Non-admins always see only their own
  if (!isAdmin || mine === 'true') {
    query = query.eq('inviter_id', caller.sub)
  }

  if (status) {
    query = query.eq('status', status as 'pending' | 'approved' | 'rejected' | 'cancelled' | 'used')
  }

  if (year) {
    const y = parseInt(year)
    if (!isNaN(y)) {
      query = query
        .gte('visit_date', `${y}-01-01`)
        .lte('visit_date', `${y}-12-31`)
    }
  }

  const { data, error } = await query
  if (error) return Response.json({ error: 'Query failed' }, { status: 500 })

  const rows = data ?? []
  if (rows.length === 0) return Response.json([])

  // Enrich with inviter data
  const inviterIds = [...new Set(rows.map((r) => r.inviter_id))]
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, telegram_username')
    .in('id', inviterIds)

  const userMap = new Map((users ?? []).map((u) => [u.id, u]))

  const enriched = rows.map((r) => ({
    ...r,
    inviter: userMap.get(r.inviter_id) ?? null,
  }))

  return Response.json(enriched)
}

export async function POST(request: NextRequest) {
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

  const parsed = CreateInvitationSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { guest_name, visit_date } = parsed.data

  // Validate visit_date is today or in the future (using UTC date comparison is sufficient for DATE type)
  const today = new Date().toISOString().slice(0, 10)
  if (visit_date < today) {
    return Response.json({ error: 'La fecha de visita debe ser hoy o en el futuro', code: 'INVALID_DATE' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const visitYear = parseInt(visit_date.slice(0, 4))

  // Count approved+used invitations for this inviter in the same calendar year
  const { count } = await supabase
    .from('guest_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('inviter_id', caller.sub)
    .in('status', ['approved', 'used'])
    .gte('visit_date', `${visitYear}-01-01`)
    .lte('visit_date', `${visitYear}-12-31`)

  const approvedCount = count ?? 0
  const is_paid = approvedCount >= FREE_INVITATIONS_PER_YEAR

  const { data: newInvitation, error: insertError } = await supabase
    .from('guest_invitations')
    .insert({
      inviter_id: caller.sub,
      guest_name: guest_name.trim(),
      visit_date,
      status: 'pending',
      is_paid,
    })
    .select('*, inviter:users!inviter_id(id, display_name, avatar_url)')
    .single()

  if (insertError || !newInvitation) {
    if (insertError?.code === '23505') {
      return Response.json(
        { error: 'Ya tienes una invitación activa para este invitado en esa fecha', code: 'DUPLICATE_INVITATION' },
        { status: 409 }
      )
    }
    console.error('[invitations] Insert failed:', insertError)
    return Response.json({ error: 'Insert failed' }, { status: 500 })
  }

  // Notify admins (fire-and-forget)
  try {
    const { data: admins } = await supabase
      .from('users')
      .select('*')
      .eq('is_admin', true)
      .eq('is_active', true)

    const { data: inviter } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', caller.sub)
      .single()

    await sendGuestInvitationRequestNotification(
      admins ?? [],
      inviter?.display_name ?? 'Un socio',
      guest_name.trim(),
      visit_date,
      is_paid
    )
  } catch (e) {
    console.error('[invitations] Failed to notify admins:', e)
  }

  return Response.json(newInvitation, { status: 201 })
}
