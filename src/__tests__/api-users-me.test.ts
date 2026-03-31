import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---
// Mock requireAuth to simulate an authenticated user
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

// Mock Supabase service client
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { PATCH } from '../app/api/users/me/route'

const mockUser = { sub: 'user-uuid-123', telegram_id: 12345 }

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/users/me', () => {
  beforeEach(() => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as ReturnType<typeof mockUser.sub extends string ? never : never> & typeof mockUser)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'))

    const req = makeRequest({ display_name: 'Test' })
    const res = await PATCH(req as Parameters<typeof PATCH>[0])
    expect(res.status).toBe(401)
  })

  it('returns 400 for bio longer than 500 chars', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)

    const req = makeRequest({ bio: 'a'.repeat(501) })
    const res = await PATCH(req as Parameters<typeof PATCH>[0])
    expect(res.status).toBe(400)
    const body = await res.json() as { code: string }
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('updates user successfully', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never)

    const updatedUser = { id: mockUser.sub, display_name: 'Juan', bio: 'Hola' }

    const mockChain = {
      from: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedUser, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mockChain as never)

    const req = makeRequest({ display_name: 'Juan', bio: 'Hola' })
    const res = await PATCH(req as Parameters<typeof PATCH>[0])
    expect(res.status).toBe(200)
    const body = await res.json() as typeof updatedUser
    expect(body.display_name).toBe('Juan')
  })
})
