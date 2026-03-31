import type { NextRequest } from 'next/server'
import { parseBggXml } from '@/lib/bgg'
import { kvCacheGet } from '@/lib/kv-cache'

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
    const data = await kvCacheGet(`bgg:${id}`, async () => {
      const res = await fetch(
        `https://boardgamegeek.com/xmlapi2/thing?id=${id}&type=boardgame`,
        {
          next: { revalidate: 3600 },
          headers: {
            'User-Agent': 'ClubDragon/1.0 (club board game manager; contact via BGG)',
            ...(process.env.BGG_API_TOKEN ? { Authorization: `Bearer ${process.env.BGG_API_TOKEN}` } : {}),
          },
        }
      )
      if (!res.ok) throw new Error(`BGG returned ${res.status}`)
      const xml = await res.text()

      const game = parseBggXml(xml, id)
      if (!game) throw new Error('Game not found in BGG response')
      return game
    }, 3600)

    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'BGG fetch failed'
    return Response.json({ error: message }, { status: 502 })
  }
}
