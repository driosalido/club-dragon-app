import { buildClearAuthCookie } from '@/lib/auth-cookie'

export async function POST(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': buildClearAuthCookie(request),
    },
  })
}
