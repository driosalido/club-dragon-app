import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return Response.json([])
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .ilike('display_name', `%${q}%`)
    .limit(10)
    .order('display_name')

  if (error) {
    return Response.json({ error: 'Query failed' }, { status: 500 })
  }

  return Response.json(data ?? [])
}
