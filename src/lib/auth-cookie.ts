export const AUTH_COOKIE_NAME = 'auth-token'
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90

function shouldUseSecureCookie(request: Request): boolean {
  const url = new URL(request.url)
  return url.protocol === 'https:'
}

export function buildAuthCookie(token: string, request: Request): string {
  const secure = shouldUseSecureCookie(request) ? '; Secure' : ''
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; HttpOnly${secure}`
}

export function buildClearAuthCookie(request: Request): string {
  const secure = shouldUseSecureCookie(request) ? '; Secure' : ''
  return `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; HttpOnly${secure}`
}
