import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import {
  sendStorageWarningNotification,
  sendStorageCriticalNotification,
  sendStorageExpiredNotification,
} from '@/lib/telegram/bot'

async function checkCronRateLimit(key: string): Promise<boolean> {
  const kvUrl = process.env.KV_REST_API_URL
  const kvToken = process.env.KV_REST_API_TOKEN

  if (!kvUrl || !kvToken || kvUrl.includes('placeholder')) return false

  try {
    const res = await fetch(`${kvUrl}/get/${key}`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    })
    if (res.ok) {
      const { result } = await res.json() as { result: string | null }
      if (result) return true
    }
    await fetch(`${kvUrl}/set/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '1', ex: 72000 }), // 20h TTL
    })
  } catch (e) {
    console.error('KV cron rate limit error:', e)
  }

  return false
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Run the PostgreSQL function to update all statuses
  const { error: rpcError } = await supabase.rpc('compute_storage_statuses')
  if (rpcError) {
    console.error('compute_storage_statuses error:', rpcError)
  }

  // Get all stored_games that need notification
  const { data: alertGames } = await supabase
    .from('stored_games')
    .select('id, status, game_id, last_session_at, slot_id, storage_slots(slot_number, label)')
    .in('status', ['warning', 'critical', 'expired'])

  let notified = 0
  const now = new Date()

  for (const game of alertGames ?? []) {
    const rateLimitKey = `cron:${game.id}:${game.status}`
    const limited = await checkCronRateLimit(rateLimitKey)
    if (limited) continue

    // Get players
    const { data: playerRows } = await supabase
      .from('stored_game_players')
      .select('user_id')
      .eq('stored_game_id', game.id)

    const playerIds = (playerRows ?? []).map((p) => p.user_id)
    const { data: players } = playerIds.length > 0
      ? await supabase.from('users').select('*').in('id', playerIds)
      : { data: [] }

    const { data: gameData } = await supabase.from('games').select('*').eq('id', game.game_id ?? '').single()

    const lastSession = game.last_session_at ? new Date(game.last_session_at) : now
    const daysLeft = 30 - Math.floor((now.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24))

    const storedGame = game as unknown as Tables<'stored_games'>
    try {
      if (game.status === 'warning') {
        await sendStorageWarningNotification(players ?? [], storedGame, gameData ?? null, daysLeft)
      } else if (game.status === 'critical') {
        await sendStorageCriticalNotification(players ?? [], storedGame, gameData ?? null, daysLeft)
      } else if (game.status === 'expired') {
        const { data: admins } = await supabase.from('users').select('*').eq('is_admin', true)
        await sendStorageExpiredNotification(players ?? [], admins ?? [], storedGame, gameData ?? null)
      }
      notified++
    } catch (e) {
      console.error(`[cron] Failed to notify for stored_game ${game.id}:`, e)
    }
  }

  return Response.json({
    updated: alertGames?.length ?? 0,
    notified,
  })
}
