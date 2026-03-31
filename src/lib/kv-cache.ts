/**
 * Simple KV cache with Upstash REST fallback to in-memory.
 * Used to avoid hammering external APIs (BGG, etc.).
 */

const memoryCache = new Map<string, { data: unknown; expires: number }>()

export async function kvCacheGet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number = 3600): Promise<T> {
  const kvUrl = process.env.KV_REST_API_URL
  const kvToken = process.env.KV_REST_API_TOKEN

  // Try Upstash KV if configured
  if (kvUrl && kvToken && !kvUrl.includes('placeholder')) {
    try {
      const getRes = await fetch(`${kvUrl}/get/${key}`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      })
      if (getRes.ok) {
        const { result } = await getRes.json() as { result: string | null }
        if (result) return JSON.parse(result) as T
      }
      const value = await fetcher()
      await fetch(`${kvUrl}/set/${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(value), ex: ttlSeconds }),
      })
      return value
    } catch {
      // Fall through to memory cache
    }
  }

  // In-memory cache fallback
  const cached = memoryCache.get(key)
  if (cached && Date.now() < cached.expires) return cached.data as T

  const value = await fetcher()
  memoryCache.set(key, { data: value, expires: Date.now() + ttlSeconds * 1000 })
  return value
}
