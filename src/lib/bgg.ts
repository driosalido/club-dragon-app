export interface BggGameData {
  bgg_id: number
  name: string
  min_players?: number
  max_players?: number
  avg_duration_min?: number
  thumbnail_url?: string
  category?: 'wargame_tablero' | 'wargame_figuras' | 'euros' | 'rol' | 'abstracto' | 'familiar'
}

function inferCategory(bgCategories: string[]): BggGameData['category'] | undefined {
  const lower = bgCategories.map((c) => c.toLowerCase())
  if (lower.some((c) => c.includes('wargame') || c.includes('war game') || c.includes('miniature'))) {
    if (lower.some((c) => c.includes('miniature') || c.includes('figure'))) return 'wargame_figuras'
    return 'wargame_tablero'
  }
  if (lower.some((c) => c.includes('role playing') || c.includes('rpg'))) return 'rol'
  if (lower.some((c) => c.includes('abstract'))) return 'abstracto'
  if (lower.some((c) => c.includes('family'))) return 'familiar'
  if (lower.some((c) => c.includes('economic') || c.includes('euro'))) return 'euros'
  return undefined
}

export function parseBggXml(xml: string, bggId: number): BggGameData | null {
  // Extract primary name
  const primaryNameMatch = xml.match(/<name[^>]*type="primary"[^>]*value="([^"]*)"/)
  const name = primaryNameMatch?.[1]
  if (!name) return null

  // Extract min/max players
  const minPlayersMatch = xml.match(/<minplayers[^>]*value="(\d+)"/)
  const maxPlayersMatch = xml.match(/<maxplayers[^>]*value="(\d+)"/)
  const playingTimeMatch = xml.match(/<playingtime[^>]*value="(\d+)"/)

  // Extract thumbnail
  const thumbnailMatch = xml.match(/<thumbnail>([^<]+)<\/thumbnail>/)

  // Extract categories
  const categoryMatches = [...xml.matchAll(/<link[^>]*type="boardgamecategory"[^>]*value="([^"]*)"[^>]*\/>/g)]
  const bgCategories = categoryMatches.map((m) => m[1])

  return {
    bgg_id: bggId,
    name: name.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
    min_players: minPlayersMatch ? parseInt(minPlayersMatch[1]) : undefined,
    max_players: maxPlayersMatch ? parseInt(maxPlayersMatch[1]) : undefined,
    avg_duration_min: playingTimeMatch ? parseInt(playingTimeMatch[1]) : undefined,
    thumbnail_url: thumbnailMatch?.[1]?.trim(),
    category: inferCategory(bgCategories),
  }
}
