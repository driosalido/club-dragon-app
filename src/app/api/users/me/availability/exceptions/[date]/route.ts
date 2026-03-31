import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  let user
  try {
    user = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { date } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('user_availability_exceptions')
    .delete()
    .eq('user_id', user.sub)
    .eq('exception_date', date)

  if (error) {
    return Response.json({ error: 'Delete failed' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
