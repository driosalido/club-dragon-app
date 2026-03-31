export async function POST() {
  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': 'auth-token=; Path=/; Max-Age=0; SameSite=Lax',
    },
  })
}
