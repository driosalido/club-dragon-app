import { createServiceClient } from '@/lib/supabase/server'
import { sendConfirmedNotification, sendJoinNotification } from '@/lib/telegram/bot'

export async function recalculateSessionStatus(
  sessionId: string,
  minPlayers: number,
  maxPlayers: number,
  hostUserId: string,
  gameId: string | null
): Promise<void> {
  const supabase = createServiceClient()

  const { data: participants } = await supabase
    .from('session_participants')
    .select('user_id, status')
    .eq('session_id', sessionId)

  if (!participants) return

  const confirmed = participants.filter((p) => p.status === 'confirmed')
  const confirmedCount = confirmed.length

  let newStatus: 'open' | 'full' | 'confirmed' = 'open'
  if (confirmedCount >= maxPlayers) newStatus = 'full'
  else if (confirmedCount >= minPlayers) newStatus = 'confirmed'

  const { data: current } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', sessionId)
    .single()

  if (!current || current.status === 'cancelled' || current.status === 'completed') return

  if (newStatus !== current.status) {
    await supabase.from('sessions').update({ status: newStatus }).eq('id', sessionId)

    // If newly confirmed, notify all participants
    if (newStatus === 'confirmed') {
      const confirmedIds = confirmed.map((p) => p.user_id)
      const { data: sessionData } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
      const { data: gameData } = gameId
        ? await supabase.from('games').select('*').eq('id', gameId).single()
        : { data: null }
      const { data: participantUsers } = await supabase.from('users').select('*').in('id', confirmedIds)

      if (sessionData && participantUsers && participantUsers.length > 0) {
        sendConfirmedNotification(participantUsers, sessionData, gameData ?? null)
          .catch((e) => console.error('Telegram confirmed notify error:', e))
      }
    }
  }

  // Notify host about new non-host join
  const nonHostParticipants = participants.filter((p) => p.user_id !== hostUserId)
  if (nonHostParticipants.length > 0) {
    const { data: hostData } = await supabase.from('users').select('*').eq('id', hostUserId).single()
    const { data: sessionData } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
    const latestJoinerId = nonHostParticipants[nonHostParticipants.length - 1].user_id
    const { data: joinerData } = await supabase.from('users').select('*').eq('id', latestJoinerId).single()

    if (hostData && sessionData && joinerData) {
      sendJoinNotification(hostData, joinerData, sessionData)
        .catch((e) => console.error('Telegram join notify error:', e))
    }
  }
}
