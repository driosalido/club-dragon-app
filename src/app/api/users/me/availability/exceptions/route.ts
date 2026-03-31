import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const AddExceptionSchema = z.object({
  exception_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  available: z.boolean().default(false),
  note: z.string().max(200).optional(),
})

export async function POST(request: NextRequest) {
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

  const parsed = AddExceptionSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('user_availability_exceptions')
    .upsert(
      {
        user_id: user.sub,
        exception_date: parsed.data.exception_date,
        available: parsed.data.available,
        note: parsed.data.note ?? null,
      },
      { onConflict: 'user_id,exception_date' }
    )
    .select()
    .single()

  if (error || !data) {
    return Response.json({ error: 'Insert failed' }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
