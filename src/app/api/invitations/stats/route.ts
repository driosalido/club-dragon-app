import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

const FREE_INVITATIONS_PER_YEAR = 2

export async function GET(request: NextRequest) {
  let caller
  try {
    caller = await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const yearParam = searchParams.get('year')
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

  if (isNaN(year) || year < 2020 || year > 2100) {
    return Response.json({ error: 'Invalid year' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const [{ count: approvedCount }, { count: pendingCount }] = await Promise.all([
    supabase
      .from('guest_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('inviter_id', caller.sub)
      .in('status', ['approved', 'used'])
      .gte('visit_date', `${year}-01-01`)
      .lte('visit_date', `${year}-12-31`),
    supabase
      .from('guest_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('inviter_id', caller.sub)
      .eq('status', 'pending')
      .gte('visit_date', `${year}-01-01`)
      .lte('visit_date', `${year}-12-31`),
  ])

  const totalApproved = approvedCount ?? 0
  const usedFree = Math.min(totalApproved, FREE_INVITATIONS_PER_YEAR)
  const remainingFree = Math.max(0, FREE_INVITATIONS_PER_YEAR - totalApproved)
  const nextIsPaid = totalApproved >= FREE_INVITATIONS_PER_YEAR

  return Response.json({
    year,
    total_approved: totalApproved,
    used_free: usedFree,
    remaining_free: remainingFree,
    pending_count: pendingCount ?? 0,
    next_is_paid: nextIsPaid,
    cost_euros: 5,
    free_limit: FREE_INVITATIONS_PER_YEAR,
  })
}
