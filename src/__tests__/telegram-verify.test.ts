import { describe, it, expect } from 'vitest'
import { createHmac, createHash } from 'crypto'
import { verifyTelegramHash, isAuthDateValid } from '@/lib/telegram/verify'

const BOT_TOKEN = 'test-bot-token-12345'

function buildValidPayload(overrides: Record<string, unknown> = {}) {
  const fields: Record<string, unknown> = {
    id: 123456789,
    first_name: 'Juan',
    username: 'juanito',
    auth_date: Math.floor(Date.now() / 1000) - 100,
    ...overrides,
  }

  // Compute correct hash
  const dataCheckString = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHash('sha256').update(BOT_TOKEN).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  return { ...fields, hash } as Parameters<typeof verifyTelegramHash>[0]
}

describe('verifyTelegramHash', () => {
  it('returns true for a valid payload', () => {
    const payload = buildValidPayload()
    expect(verifyTelegramHash(payload, BOT_TOKEN)).toBe(true)
  })

  it('returns false when hash is tampered', () => {
    const payload = buildValidPayload()
    const tampered = { ...payload, hash: 'deadbeef' + payload.hash.slice(8) }
    expect(verifyTelegramHash(tampered, BOT_TOKEN)).toBe(false)
  })

  it('returns false when a field is modified after signing', () => {
    const payload = buildValidPayload()
    const tampered = { ...payload, first_name: 'Hacker' }
    expect(verifyTelegramHash(tampered, BOT_TOKEN)).toBe(false)
  })

  it('returns false when wrong bot token is used', () => {
    const payload = buildValidPayload()
    expect(verifyTelegramHash(payload, 'wrong-token')).toBe(false)
  })
})

describe('isAuthDateValid', () => {
  it('returns true when auth_date is recent', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(isAuthDateValid(now - 60, now)).toBe(true)
  })

  it('returns true when auth_date is exactly 86399 seconds ago', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(isAuthDateValid(now - 86399, now)).toBe(true)
  })

  it('returns false when auth_date is 86400 seconds ago', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(isAuthDateValid(now - 86400, now)).toBe(false)
  })

  it('returns false when auth_date is much older', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(isAuthDateValid(now - 100000, now)).toBe(false)
  })
})
