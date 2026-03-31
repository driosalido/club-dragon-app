import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  let caller
  try {
    caller = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')

  const supabase = createServiceClient()

  // No query → admin-only full list
  if (!q || q.trim().length < 2) {
    const { data: callerData } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', caller.sub)
      .single()

    if (!callerData?.is_admin) {
      return Response.json([])
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, telegram_username, avatar_url, member_number, is_admin, is_active, created_at')
      .order('member_number', { ascending: true, nullsFirst: false })
      .order('display_name')

    if (error) return Response.json({ error: 'Query failed' }, { status: 500 })
    return Response.json(data ?? [])
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .ilike('display_name', `%${q}%`)
    .limit(10)
    .order('display_name')

  if (error) return Response.json({ error: 'Query failed' }, { status: 500 })
  return Response.json(data ?? [])
}
