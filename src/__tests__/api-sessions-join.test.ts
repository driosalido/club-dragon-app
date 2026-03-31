import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))
vi.mock('@/lib/matching/session-status', () => ({
  recalculateSessionStatus: vi.fn().mockResolvedValue(undefined),
}))

import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { POST } from '../app/api/sessions/[id]/join/route'

const mockUser = { sub: 'user-uuid-123', telegram_id: 12345 }

function makeJoinRequest(body: unknown = {}) {
  return new Request('http://localhost/api/sessions/session-1/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeSupabase(sessionData: unknown, confirmedCount = 0) {
  const singleSession = vi.fn().mockResolvedValue({ data: sessionData, error: null })
  const countSelect = vi.fn().mockResolvedValue({ data: Array(confirmedCount).fill({ user_id: 'x' }), error: null })
  const upsertSingle = vi.fn().mockResolvedValue({ data: { session_id: 'session-1', user_id: mockUser.sub, status: 'confirmed' }, error: null })

  return vi.fn().mockImplementation(() => ({
    from: (table: string) => {
      if (table === 'sessions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({ single: singleSession }),
        }
      }
      if (table === 'session_participants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          mockReturnValue: vi.fn(),
          // For upsert chain
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: upsertSingle }),
          }),
          // For count query
          ...(confirmedCount !== undefined ? { [Symbol.iterator]: undefined } : {}),
        }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() }
    },
  }))
}

describe('POST /api/sessions/[id]/join', () => {
  beforeEach(() => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'))
    const req = makeJoinRequest({ status: 'confirmed' })
    const res = await POST(req as Parameters<typeof POST>[0], { params: Promise.resolve({ id: 'session-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 400 for cancelled session', async () => {
    const singleFn = vi.fn().mockResolvedValue({
      data: { status: 'cancelled', max_players: 4, min_players: 2, host_user_id: 'host', game_id: 'g1' },
      error: null,
    })
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ single: singleFn }) }),
    } as never)

    const req = makeJoinRequest({ status: 'confirmed' })
    const res = await POST(req as Parameters<typeof POST>[0], { params: Promise.resolve({ id: 'session-1' }) })
    expect(res.status).toBe(400)
    const body = await res.json() as { code: string }
    expect(body.code).toBe('SESSION_CLOSED')
  })

  it('returns 400 for completed session', async () => {
    const singleFn = vi.fn().mockResolvedValue({
      data: { status: 'completed', max_players: 4, min_players: 2, host_user_id: 'host', game_id: 'g1' },
      error: null,
    })
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ single: singleFn }) }),
    } as never)

    const req = makeJoinRequest({ status: 'confirmed' })
    const res = await POST(req as Parameters<typeof POST>[0], { params: Promise.resolve({ id: 'session-1' }) })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/sessions/[id] authorization', () => {
  it('returns 403 when non-host tries to patch', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)

    const singleFn = vi.fn().mockResolvedValue({
      data: { host_user_id: 'different-user', status: 'open', game_id: 'g1' },
      error: null,
    })
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ single: singleFn }) }),
    } as never)

    const { PATCH } = await import('../app/api/sessions/[id]/route')
    const req = new Request('http://localhost/api/sessions/s1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New title' }),
    })
    const res = await PATCH(req as Parameters<typeof PATCH>[0], { params: Promise.resolve({ id: 's1' }) })
    expect(res.status).toBe(403)
  })
})
