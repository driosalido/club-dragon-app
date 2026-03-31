import { createHmac } from 'crypto'

export interface MiniAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

export function verifyMiniAppInitData(initData: string, botToken: string): MiniAppUser | null {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null

    params.delete('hash')

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
    const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    if (expectedHash !== hash) return null

    const authDate = parseInt(params.get('auth_date') ?? '0')
    if (Date.now() / 1000 - authDate > 86400) return null

    const userJson = params.get('user')
    if (!userJson) return null

    return JSON.parse(userJson) as MiniAppUser
  } catch {
    return null
  }
}
