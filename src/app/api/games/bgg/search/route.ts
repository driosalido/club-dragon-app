import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 2) return Response.json([])

  try {
    const res = await fetch(
      `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(q)}&type=boardgame`,
      {
        next: { revalidate: 300 },
        headers: { 'User-Agent': 'ClubDragon/1.0 (club board game manager; contact via BGG)' },
      }
    )
    if (!res.ok) return Response.json([])

    const xml = await res.text()

    // Parse search results — each item has id + name value
    const items = [...xml.matchAll(/<item[^>]+id="(\d+)"[^>]*>[\s\S]*?<name[^>]+value="([^"]+)"[\s\S]*?<\/item>/g)]

    // Also grab yearpublished if present
    const results = items.slice(0, 12).map((m) => {
      const yearMatch = m[0].match(/<yearpublished[^>]+value="(\d+)"/)
      return {
        bgg_id: parseInt(m[1]),
        name: m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
        year: yearMatch ? parseInt(yearMatch[1]) : null,
      }
    })

    return Response.json(results)
  } catch {
    return Response.json([])
  }
}
