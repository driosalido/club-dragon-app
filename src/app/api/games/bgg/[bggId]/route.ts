import type { NextRequest } from 'next/server'
import { parseBggXml } from '@/lib/bgg'

// Simple in-memory cache (1 hour TTL) — Vercel KV used if env vars present
const cache = new Map<string, { data: unknown; expires: number }>()

async function getCachedOrFetch(key: string, fetcher: () => Promise<unknown>): Promise<unknown> {
  const kvUrl = process.env.KV_REST_API_URL
  const kvToken = process.env.KV_REST_API_TOKEN
  const ttl = 3600

  // Try Vercel KV if configured (not placeholder)
  if (kvUrl && kvToken && !kvUrl.includes('placeholder')) {
    try {
      const getRes = await fetch(`${kvUrl}/get/${key}`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      })
      if (getRes.ok) {
        const { result } = await getRes.json() as { result: string | null }
        if (result) return JSON.parse(result)
      }
      const value = await fetcher()
      await fetch(`${kvUrl}/set/${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(value), ex: ttl }),
      })
      return value
    } catch {
      // Fall through to memory cache
    }
  }

  // In-memory cache fallback
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expires) return cached.data

  const value = await fetcher()
  cache.set(key, { data: value, expires: Date.now() + ttl * 1000 })
  return value
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bggId: string }> }
) {
  const { bggId } = await params
  const id = parseInt(bggId)

  if (isNaN(id) || id <= 0) {
    return Response.json({ error: 'Invalid BGG ID' }, { status: 400 })
  }

  try {
    const data = await getCachedOrFetch(`bgg:${id}`, async () => {
      const res = await fetch(
        `https://boardgamegeek.com/xmlapi2/thing?id=${id}&type=boardgame`,
        {
          next: { revalidate: 3600 },
          headers: { 'User-Agent': 'ClubDragon/1.0 (club board game manager; contact via BGG)' },
        }
      )
      if (!res.ok) throw new Error(`BGG returned ${res.status}`)
      const xml = await res.text()

      const game = parseBggXml(xml, id)
      if (!game) throw new Error('Game not found in BGG response')
      return game
    })

    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'BGG fetch failed'
    return Response.json({ error: message }, { status: 502 })
  }
}
