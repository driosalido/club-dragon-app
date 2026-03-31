import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))
vi.mock('@/lib/telegram/bot', () => ({
  sendStorageWarningNotification: vi.fn().mockResolvedValue(undefined),
  sendStorageCriticalNotification: vi.fn().mockResolvedValue(undefined),
  sendStorageExpiredNotification: vi.fn().mockResolvedValue(undefined),
  sendStorageEvictedNotification: vi.fn().mockResolvedValue(undefined),
}))

import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import {
  sendStorageWarningNotification,
  sendStorageCriticalNotification,
  sendStorageExpiredNotification,
} from '@/lib/telegram/bot'

const mockUser = { sub: 'player-uuid-001', telegram_id: 11111 }
const mockAdminUser = { sub: 'admin-uuid-002', telegram_id: 22222 }

function makeRequest(method: string, body?: unknown) {
  return new Request('http://localhost/api/storage/stored-games/sg-1/sessions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ─── POST /api/storage/stored-games/[id]/sessions ──────────────────────────
describe('POST /api/storage/stored-games/[id]/sessions', () => {
  beforeEach(() => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'))
    const { POST } = await import('../app/api/storage/stored-games/[id]/sessions/route')
    const res = await POST(
      makeRequest('POST', { session_date: '2026-01-15' }) as never,
      { params: Promise.resolve({ id: 'sg-1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not a player', async () => {
    const playerSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'stored_game_players') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: playerSingle }) }) }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() }
      },
    } as never)

    const { POST } = await import('../app/api/storage/stored-games/[id]/sessions/route')
    const res = await POST(
      makeRequest('POST', { session_date: '2026-01-15' }) as never,
      { params: Promise.resolve({ id: 'sg-1' }) }
    )
    expect(res.status).toBe(403)
    const body = await res.json() as { code: string }
    expect(body.code).toBe('NOT_A_PLAYER')
  })

  it('returns 400 for future session_date', async () => {
    const playerSingle = vi.fn().mockResolvedValue({ data: { user_id: mockUser.sub }, error: null })
    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'stored_game_players') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: playerSingle }) }) }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() }
      },
    } as never)

    const { POST } = await import('../app/api/storage/stored-games/[id]/sessions/route')
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
    const res = await POST(
      makeRequest('POST', { session_date: futureDate }) as never,
      { params: Promise.resolve({ id: 'sg-1' }) }
    )
    expect(res.status).toBe(400)
    const body = await res.json() as { code: string }
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 201 and inserts session when user is a player', async () => {
    const playerSingle = vi.fn().mockResolvedValue({ data: { user_id: mockUser.sub }, error: null })
    const sessionSingle = vi.fn().mockResolvedValue({
      data: { id: 'sess-1', stored_game_id: 'sg-1', session_date: '2026-01-15' },
      error: null,
    })
    const gameSingle = vi.fn().mockResolvedValue({
      data: { id: 'sg-1', status: 'active', last_session_at: '2026-01-15T00:00:00Z' },
      error: null,
    })

    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'stored_game_players') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: playerSingle }) }) }
        }
        if (table === 'stored_game_sessions') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: sessionSingle }),
            }),
          }
        }
        if (table === 'stored_games') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ single: gameSingle }) }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() }
      },
    } as never)

    const { POST } = await import('../app/api/storage/stored-games/[id]/sessions/route')
    const res = await POST(
      makeRequest('POST', { session_date: '2026-01-15', duration_minutes: 90 }) as never,
      { params: Promise.resolve({ id: 'sg-1' }) }
    )
    expect(res.status).toBe(201)
    const body = await res.json() as { session: { id: string }; stored_game: { id: string } }
    expect(body.session.id).toBe('sess-1')
    expect(body.stored_game.id).toBe('sg-1')
  })
})

// ─── PATCH /api/storage/stored-games/[id] — admin-only eviction ─────────────
describe('PATCH /api/storage/stored-games/[id] eviction', () => {
  it('returns 403 when non-admin tries to evict', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)

    const playerSingle = vi.fn().mockResolvedValue({ data: { user_id: mockUser.sub }, error: null })
    const adminSingle = vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null })

    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'stored_game_players') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: playerSingle }) }) }
        }
        if (table === 'users') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ single: adminSingle }) }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() }
      },
    } as never)

    const { PATCH } = await import('../app/api/storage/stored-games/[id]/route')
    const req = new Request('http://localhost/api/storage/stored-games/sg-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'evicted' }),
    })
    const res = await PATCH(req as never, { params: Promise.resolve({ id: 'sg-1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 200 when admin evicts a stored game', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockAdminUser as never)

    const playerCheckSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const adminSingle = vi.fn().mockResolvedValue({ data: { is_admin: true }, error: null })
    const updateSingle = vi.fn().mockResolvedValue({ data: { id: 'sg-1', status: 'evicted' }, error: null })
    const playerRows = vi.fn().mockResolvedValue({ data: [{ user_id: 'player-1' }], error: null })
    const usersRows = vi.fn().mockResolvedValue({ data: [{ id: 'player-1', telegram_id: 99999, display_name: 'Jugador' }], error: null })
    const gameSingle = vi.fn().mockResolvedValue({ data: { id: 'game-1', name: 'Twilight Imperium' }, error: null })

    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'stored_game_players') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((_col: string, _val: string) => ({
              eq: vi.fn().mockReturnValue({ single: playerCheckSingle }),
              then: (resolve: (v: { data: unknown[] }) => void) => resolve({ data: [{ user_id: 'player-1' }] }),
            })),
          }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((col: string) => {
              if (col === 'is_admin') return { then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }) }
              return { single: adminSingle }
            }),
            in: vi.fn().mockReturnValue(usersRows()),
          }
        }
        if (table === 'stored_games') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({ single: updateSingle }),
              }),
            }),
          }
        }
        if (table === 'games') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ single: gameSingle }) }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      },
    } as never)

    const { PATCH } = await import('../app/api/storage/stored-games/[id]/route')
    const req = new Request('http://localhost/api/storage/stored-games/sg-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'evicted' }),
    })
    const res = await PATCH(req as never, { params: Promise.resolve({ id: 'sg-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe('evicted')
  })
})

// ─── POST /api/cron/storage-semaphore ──────────────────────────────────────
describe('POST /api/cron/storage-semaphore', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret-cron')
    vi.stubEnv('KV_REST_API_URL', '')
    vi.stubEnv('KV_REST_API_TOKEN', '')
  })

  it('returns 401 without valid CRON_SECRET', async () => {
    const { POST } = await import('../app/api/cron/storage-semaphore/route')
    const req = new Request('http://localhost/api/cron/storage-semaphore', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('only notifies games with warning/critical/expired status', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: (table: string) => {
        if (table === 'stored_games') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'sg-warning', status: 'warning', game_id: 'game-1', last_session_at: new Date(Date.now() - 25 * 86400000).toISOString(), slot_id: 's1', storage_slots: null },
                { id: 'sg-critical', status: 'critical', game_id: 'game-1', last_session_at: new Date(Date.now() - 29 * 86400000).toISOString(), slot_id: 's2', storage_slots: null },
              ],
              error: null,
            }),
          }
        }
        if (table === 'stored_game_players') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [{ user_id: 'u1' }], error: null }) }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [{ id: 'u1', telegram_id: 123, display_name: 'Player' }], error: null }),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        if (table === 'games') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { name: 'Testgame' }, error: null }) }) }
        }
        return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [], error: null }) }
      },
    } as never)

    const { POST } = await import('../app/api/cron/storage-semaphore/route')
    const req = new Request('http://localhost/api/cron/storage-semaphore', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret-cron' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
    const body = await res.json() as { updated: number; notified: number }
    expect(body.updated).toBe(2)
    expect(body.notified).toBe(2)
    expect(sendStorageWarningNotification).toHaveBeenCalledTimes(1)
    expect(sendStorageCriticalNotification).toHaveBeenCalledTimes(1)
    expect(sendStorageExpiredNotification).not.toHaveBeenCalled()
  })

  it('notifies admins for expired games', async () => {
    vi.mocked(sendStorageExpiredNotification).mockClear()
    vi.mocked(createServiceClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: (table: string) => {
        if (table === 'stored_games') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'sg-expired', status: 'expired', game_id: 'game-1', last_session_at: new Date(Date.now() - 35 * 86400000).toISOString(), slot_id: 's1', storage_slots: null },
              ],
              error: null,
            }),
          }
        }
        if (table === 'stored_game_players') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [{ user_id: 'u1' }], error: null }) }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [{ id: 'u1', telegram_id: 123 }], error: null }),
            eq: vi.fn().mockResolvedValue({ data: [{ id: 'admin-1', telegram_id: 999 }], error: null }),
          }
        }
        if (table === 'games') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { name: 'Testgame' }, error: null }) }) }
        }
        return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [], error: null }) }
      },
    } as never)

    const { POST } = await import('../app/api/cron/storage-semaphore/route')
    const req = new Request('http://localhost/api/cron/storage-semaphore', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret-cron' },
    })
    await POST(req as never)
    expect(sendStorageExpiredNotification).toHaveBeenCalledTimes(1)
  })
})

// ─── POST /api/storage/stored-games — slot conflict ─────────────────────────
describe('POST /api/storage/stored-games slot validation', () => {
  it('returns 409 when slot is already occupied', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)

    const occupiedSingle = vi.fn().mockResolvedValue({ data: { id: 'existing-sg' }, error: null })

    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'stored_games') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnValue({ single: occupiedSingle }),
          }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn() }
      },
    } as never)

    const { POST } = await import('../app/api/storage/stored-games/route')
    const req = new Request('http://localhost/api/storage/stored-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot_id: '550e8400-e29b-41d4-a716-446655440001',
        game_id: '550e8400-e29b-41d4-a716-446655440002',
        players: [{ user_id: '550e8400-e29b-41d4-a716-446655440003' }],
      }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(409)
    const body = await res.json() as { code: string }
    expect(body.code).toBe('SLOT_OCCUPIED')
  })
})
