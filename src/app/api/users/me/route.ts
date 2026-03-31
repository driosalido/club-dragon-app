import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const PatchUserSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  member_number: z.number().int().positive().nullable().optional(),
})

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  await supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.sub)

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.sub)
    .single()

  if (error || !data) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  return Response.json(data)
}

export async function PATCH(request: NextRequest) {
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

  const parsed = PatchUserSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('users')
    .update({ ...parsed.data, last_seen_at: new Date().toISOString() })
    .eq('id', user.sub)
    .select()
    .single()

  if (error || !data) {
    return Response.json({ error: 'Update failed' }, { status: 500 })
  }

  return Response.json(data)
}
