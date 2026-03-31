import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { kvCacheGet } from '@/lib/kv-cache'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 2) return Response.json([])

  const cacheKey = `bgg:search:${q.trim().toLowerCase()}`

  try {
    const results = await kvCacheGet(cacheKey, async () => {
      const res = await fetch(
        `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(q)}&type=boardgame`,
        {
          next: { revalidate: 300 },
          headers: {
            'User-Agent': 'ClubDragon/1.0 (club board game manager; contact via BGG)',
            ...(process.env.BGG_API_TOKEN ? { Authorization: `Bearer ${process.env.BGG_API_TOKEN}` } : {}),
          },
        }
      )
      if (!res.ok) return []

      const xml = await res.text()

      const items = [...xml.matchAll(/<item[^>]+id="(\d+)"[^>]*>[\s\S]*?<name[^>]+value="([^"]+)"[\s\S]*?<\/item>/g)]

      return items.slice(0, 12).map((m) => {
        const yearMatch = m[0].match(/<yearpublished[^>]+value="(\d+)"/)
        return {
          bgg_id: parseInt(m[1]),
          name: m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
          year: yearMatch ? parseInt(yearMatch[1]) : null,
        }
      })
    }, 300)

    return Response.json(results)
  } catch {
    return Response.json([])
  }
}
