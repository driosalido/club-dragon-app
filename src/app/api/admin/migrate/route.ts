import { createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createServiceClient()

  // Migration: add responsible_user_id to stored_games
  const { error } = await supabase.rpc('exec_migration' as never, {} as never)

  // Try direct approach via insert into a migration table or use raw postgrest
  // Since we can't run arbitrary SQL via JS client easily, use the REST API directly
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const sql = `ALTER TABLE stored_games ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES users(id) ON DELETE SET NULL;`

  const res = await fetch(`${url}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'apikey': key,
    },
    body: JSON.stringify({ sql }),
  })

  if (!res.ok) {
    // Fallback: try Supabase Management API
    return Response.json({ error: 'exec rpc not available', status: res.status, body: await res.text() }, { status: 500 })
  }

  return Response.json({ ok: true })
}
