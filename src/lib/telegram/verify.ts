import { createHmac, createHash } from 'crypto'

export interface TelegramAuthData {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export function verifyTelegramHash(data: TelegramAuthData, botToken: string): boolean {
  const { hash, ...fields } = data

  const dataCheckString = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHash('sha256').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  return expectedHash === hash
}

export function isAuthDateValid(authDate: number, nowSeconds?: number): boolean {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000)
  return now - authDate < 86400
}
