import { createServiceClient } from '@/lib/supabase/server'
import { sendNewSessionNotification } from '@/lib/telegram/bot'

const INTEREST_ORDER: Record<string, number> = {
  own_and_teach: 3,
  want_to_play: 2,
  learning: 1,
}

async function checkRateLimit(userId: string, gameId: string): Promise<boolean> {
  const kvUrl = process.env.KV_REST_API_URL
  const kvToken = process.env.KV_REST_API_TOKEN

  if (!kvUrl || !kvToken || kvUrl.includes('placeholder')) return false

  const key = `notify:${userId}:${gameId}`
  try {
    const res = await fetch(`${kvUrl}/get/${key}`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    })
    if (res.ok) {
      const { result } = await res.json() as { result: string | null }
      if (result) return true // rate limited
    }

    // Set with 24h TTL
    await fetch(`${kvUrl}/set/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '1', ex: 86400 }),
    })
  } catch (e) {
    console.error('KV rate limit check error:', e)
  }

  return false
}

export async function notifyNewSession(sessionId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (!session || !session.game_id) return

  const { data: gameData } = await supabase
    .from('games')
    .select('*')
    .eq('id', session.game_id)
    .single()

  const hostId = session.host_user_id
  const gameId = session.game_id
  const sessionDate = session.scheduled_date

  // Get all users interested in this game (excluding host)
  const { data: userGames } = await supabase
    .from('user_games')
    .select('user_id, interest_level')
    .eq('game_id', gameId)
    .neq('user_id', hostId)

  if (!userGames || userGames.length === 0) {
    console.log(`[matching] No candidates for session ${sessionId}`)
    return
  }

  // Exclude users already in another session of the same game on that date
  const { data: conflictingParticipants } = await supabase
    .from('session_participants')
    .select('user_id, session_id')
    .neq('session_id', sessionId)

  // We need to check if those sessions are for the same game/date
  // Get sessions for same game and date
  const { data: sameDaySessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('game_id', gameId)
    .eq('scheduled_date', sessionDate)
    .in('status', ['open', 'full', 'confirmed'])
    .neq('id', sessionId)

  const sameDaySessionIds = new Set((sameDaySessions ?? []).map((s) => s.id))
  const conflictingUserIds = new Set(
    (conflictingParticipants ?? [])
      .filter((p) => sameDaySessionIds.has(p.session_id))
      .map((p) => p.user_id)
  )

  // Sort candidates
  const candidates = userGames
    .filter((ug) => !conflictingUserIds.has(ug.user_id))
    .sort((a, b) => (INTEREST_ORDER[b.interest_level] ?? 0) - (INTEREST_ORDER[a.interest_level] ?? 0))

  if (candidates.length === 0) {
    console.log(`[matching] All candidates excluded for session ${sessionId}`)
    return
  }

  // Fetch candidate users
  const candidateIds = candidates.map((c) => c.user_id)
  const { data: candidateUsers } = await supabase
    .from('users')
    .select('*')
    .in('id', candidateIds)

  const userMap = new Map((candidateUsers ?? []).map((u) => [u.id, u]))

  let notified = 0

  for (const candidate of candidates) {
    const user = userMap.get(candidate.user_id)
    if (!user) continue

    const limited = await checkRateLimit(candidate.user_id, gameId)
    if (limited) continue

    try {
      await sendNewSessionNotification(user, session, gameData ?? null)
      notified++
    } catch (e) {
      console.error(`[matching] Failed to notify user ${candidate.user_id}:`, e)
    }
  }

  console.log(`[matching] Session ${sessionId}: notified ${notified}/${candidates.length} candidates`)
}
