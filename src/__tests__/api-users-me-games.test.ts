import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { POST } from '../app/api/users/me/games/route'
import { DELETE } from '../app/api/users/me/games/[game_id]/route'

const mockUser = { sub: 'user-uuid-123', telegram_id: 12345 }

describe('POST /api/users/me/games', () => {
  beforeEach(() => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)
  })

  it('returns 400 for invalid interest_level', async () => {
    const req = new Request('http://localhost/api/users/me/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: '550e8400-e29b-41d4-a716-446655440000', interest_level: 'invalid' }),
    })
    const res = await POST(req as Parameters<typeof POST>[0])
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing game_id', async () => {
    const req = new Request('http://localhost/api/users/me/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interest_level: 'want_to_play' }),
    })
    const res = await POST(req as Parameters<typeof POST>[0])
    expect(res.status).toBe(400)
  })

  it('returns 404 when game does not exist', async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqFn = vi.fn().mockReturnValue({ single: singleFn })
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
    const fromFn = vi.fn().mockReturnValue({ select: selectFn })
    vi.mocked(createServiceClient).mockReturnValue({ from: fromFn } as never)

    const req = new Request('http://localhost/api/users/me/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: '550e8400-e29b-41d4-a716-446655440000', interest_level: 'want_to_play' }),
    })
    const res = await POST(req as Parameters<typeof POST>[0])
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/users/me/games/[game_id]', () => {
  beforeEach(() => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'))

    const req = new Request('http://localhost/api/users/me/games/some-id', { method: 'DELETE' })
    const res = await DELETE(
      req as Parameters<typeof DELETE>[0],
      { params: Promise.resolve({ game_id: 'some-id' }) }
    )
    expect(res.status).toBe(401)
  })

  it('deletes successfully and returns 204', async () => {
    const mockChain = {
      from: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      mockResolvedValue: vi.fn(),
    }
    // Chain returns { error: null }
    const eqMock = vi.fn().mockReturnThis()
    const deleteMock = vi.fn().mockReturnThis()
    const fromMock = vi.fn().mockReturnValue({
      delete: deleteMock,
    })
    deleteMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    vi.mocked(createServiceClient).mockReturnValue({ from: fromMock } as never)

    const req = new Request('http://localhost/api/users/me/games/game-id-1', { method: 'DELETE' })
    const res = await DELETE(
      req as Parameters<typeof DELETE>[0],
      { params: Promise.resolve({ game_id: 'game-id-1' }) }
    )
    expect(res.status).toBe(204)
  })
})
