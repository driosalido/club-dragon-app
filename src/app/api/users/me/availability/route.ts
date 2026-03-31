import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const AvailabilitySlotSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  time_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  time_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})

const PutAvailabilitySchema = z.array(AvailabilitySlotSchema)

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('user_availability')
    .select('*')
    .eq('user_id', user.sub)
    .order('day_of_week')

  if (error) {
    return Response.json({ error: 'Query failed' }, { status: 500 })
  }

  return Response.json(data ?? [])
}

export async function PUT(request: NextRequest) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PutAvailabilitySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Delete existing slots and re-insert
  await supabase.from('user_availability').delete().eq('user_id', user.sub)

  if (parsed.data.length === 0) {
    return Response.json([])
  }

  const slots = parsed.data.map((slot) => ({ ...slot, user_id: user.sub }))

  const { data, error } = await supabase
    .from('user_availability')
    .insert(slots)
    .select()

  if (error) {
    return Response.json({ error: 'Insert failed' }, { status: 500 })
  }

  return Response.json(data ?? [])
}
