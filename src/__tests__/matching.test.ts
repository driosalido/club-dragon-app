import { describe, it, expect } from 'vitest'

// Unit test for matching logic — pure functions extracted from the algorithm

const INTEREST_ORDER: Record<string, number> = {
  own_and_teach: 3,
  want_to_play: 2,
  learning: 1,
}

interface Candidate {
  user_id: string
  interest_level: string
}

function sortCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort(
    (a, b) => (INTEREST_ORDER[b.interest_level] ?? 0) - (INTEREST_ORDER[a.interest_level] ?? 0)
  )
}

function filterCandidates(
  candidates: Candidate[],
  hostId: string,
  conflictingUserIds: Set<string>
): Candidate[] {
  return candidates.filter(
    (c) => c.user_id !== hostId && !conflictingUserIds.has(c.user_id)
  )
}

describe('matching algorithm', () => {
  const candidates: Candidate[] = [
    { user_id: 'u1', interest_level: 'learning' },
    { user_id: 'u2', interest_level: 'own_and_teach' },
    { user_id: 'u3', interest_level: 'want_to_play' },
    { user_id: 'u4', interest_level: 'own_and_teach' },
  ]

  it('sorts candidates: own_and_teach > want_to_play > learning', () => {
    const sorted = sortCandidates(candidates)
    expect(sorted[0].interest_level).toBe('own_and_teach')
    expect(sorted[1].interest_level).toBe('own_and_teach')
    expect(sorted[2].interest_level).toBe('want_to_play')
    expect(sorted[3].interest_level).toBe('learning')
  })

  it('excludes the host from candidates', () => {
    const filtered = filterCandidates(candidates, 'u2', new Set())
    expect(filtered.find((c) => c.user_id === 'u2')).toBeUndefined()
    expect(filtered.length).toBe(3)
  })

  it('excludes users already in conflicting sessions', () => {
    const conflicting = new Set(['u1', 'u3'])
    const filtered = filterCandidates(candidates, 'host', conflicting)
    expect(filtered.map((c) => c.user_id)).toEqual(['u2', 'u4'])
  })

  it('returns empty when all candidates are excluded', () => {
    const allIds = new Set(candidates.map((c) => c.user_id))
    const filtered = filterCandidates(candidates, 'host', allIds)
    expect(filtered).toHaveLength(0)
  })
})

describe('session status transitions', () => {
  function computeStatus(
    confirmedCount: number,
    minPlayers: number,
    maxPlayers: number
  ): 'open' | 'full' | 'confirmed' {
    if (confirmedCount >= maxPlayers) return 'full'
    if (confirmedCount >= minPlayers) return 'confirmed'
    return 'open'
  }

  it('open when below min_players', () => {
    expect(computeStatus(1, 4, 6)).toBe('open')
  })

  it('confirmed when reaching min_players', () => {
    expect(computeStatus(4, 4, 6)).toBe('confirmed')
  })

  it('confirmed when between min and max', () => {
    expect(computeStatus(5, 4, 6)).toBe('confirmed')
  })

  it('full when reaching max_players', () => {
    expect(computeStatus(6, 4, 6)).toBe('full')
  })

  it('full when exceeding max_players', () => {
    expect(computeStatus(7, 4, 6)).toBe('full')
  })
})
