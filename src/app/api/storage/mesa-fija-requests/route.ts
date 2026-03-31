import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMesaFijaRequestNotification } from '@/lib/telegram/bot'

const CreateRequestSchema = z.object({
  slot_id: z.string().uuid().optional(),
  game_id: z.string().uuid(),
  reason: z.string().max(1000).optional(),
  expected_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET(request: NextRequest) {
  let caller
  try {
    caller = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const slot_id = searchParams.get('slot_id')
  const mine = searchParams.get('mine')

  const supabase = createServiceClient()

  let query = supabase
    .from('mesa_fija_requests')
    .select('*')
    .order('queue_position', { ascending: true })
    .order('requested_at', { ascending: true })

  if (status) {
    query = query.eq('status', status as 'queued' | 'approved' | 'rejected' | 'assigned' | 'cancelled' | 'expired')
  }
  if (slot_id) {
    query = query.eq('slot_id', slot_id)
  }
  if (mine === 'true') {
    query = query.eq('requester_id', caller.sub)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: 'Query failed' }, { status: 500 })

  const rows = data ?? []
  if (rows.length === 0) return Response.json([])

  // Enrich with related data
  const requesterIds = [...new Set(rows.map((r) => r.requester_id))]
  const gameIds = [...new Set(rows.map((r) => r.game_id))]
  const slotIds = [...new Set(rows.map((r) => r.slot_id).filter(Boolean) as string[])]

  const [{ data: users }, { data: games }, { data: slots }] = await Promise.all([
    supabase.from('users').select('id, display_name, avatar_url, telegram_username').in('id', requesterIds),
    supabase.from('games').select('id, name, category, thumbnail_url').in('id', gameIds),
    slotIds.length > 0
      ? supabase.from('storage_slots').select('id, slot_number, label').in('id', slotIds)
      : Promise.resolve({ data: [] }),
  ])

  const userMap = new Map((users ?? []).map((u) => [u.id, u]))
  const gameMap = new Map((games ?? []).map((g) => [g.id, g]))
  const slotMap = new Map((slots ?? []).map((s) => [s.id, s]))

  const enriched = rows.map((r) => ({
    ...r,
    requester: userMap.get(r.requester_id) ?? null,
    game: gameMap.get(r.game_id) ?? null,
    slot: r.slot_id ? (slotMap.get(r.slot_id) ?? null) : null,
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
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // If slot_id provided, verify it's a mesa_fija slot
  if (parsed.data.slot_id) {
    const { data: slot } = await supabase
      .from('storage_slots')
      .select('slot_type, is_active')
      .eq('id', parsed.data.slot_id)
      .single()

    if (!slot || !slot.is_active) {
      return Response.json({ error: 'Slot not found or inactive' }, { status: 404 })
    }
    if (slot.slot_type !== 'mesa_fija') {
      return Response.json({ error: 'Slot is not a mesa fija', code: 'NOT_MESA_FIJA' }, { status: 400 })
    }
  }

  // Compute next queue_position for this slot (or global if no slot_id)
  const posQuery = supabase
    .from('mesa_fija_requests')
    .select('queue_position')
    .in('status', ['queued', 'approved'])
    .order('queue_position', { ascending: false })
    .limit(1)

  if (parsed.data.slot_id) {
    posQuery.eq('slot_id', parsed.data.slot_id)
  } else {
    posQuery.is('slot_id', null)
  }

  const { data: lastPos } = await posQuery
  const queue_position = lastPos && lastPos.length > 0 ? (lastPos[0]!.queue_position + 1) : 1

  const { data: newRequest, error: insertError } = await supabase
    .from('mesa_fija_requests')
    .insert({
      slot_id: parsed.data.slot_id ?? null,
      requester_id: caller.sub,
      game_id: parsed.data.game_id,
      reason: parsed.data.reason ?? null,
      expected_end_date: parsed.data.expected_end_date ?? null,
      queue_position,
      status: 'queued',
    })
    .select(`
      *,
      requester:users!requester_id(id, display_name, avatar_url),
      game:games!game_id(id, name, category, thumbnail_url)
    `)
    .single()

  if (insertError || !newRequest) {
    if (insertError?.code === '23505') {
      return Response.json({ error: 'Ya tienes una solicitud activa para esta mesa', code: 'DUPLICATE_REQUEST' }, { status: 409 })
    }
    return Response.json({ error: 'Insert failed' }, { status: 500 })
  }

  // Notify admins
  try {
    const { data: admins } = await supabase.from('users').select('*').eq('is_admin', true).eq('is_active', true)
    const { data: gameData } = await supabase.from('games').select('*').eq('id', parsed.data.game_id).single()
    await sendMesaFijaRequestNotification(admins ?? [], newRequest, gameData ?? null)
  } catch (e) {
    console.error('[mesa_fija] Failed to notify admins:', e)
  }

  return Response.json(newRequest, { status: 201 })
}
