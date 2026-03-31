import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const PatchUserAdminSchema = z.object({
  member_number: z.number().int().positive().nullable().optional(),
  display_name: z.string().min(1).max(100).optional(),
  is_admin: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

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

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchUserAdminSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { id } = await params

  const { data, error } = await supabase
    .from('users')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return Response.json({ error: 'Update failed' }, { status: 500 })
  }

  return Response.json(data)
}
