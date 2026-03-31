import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import PerfilClient from './PerfilClient'
import { redirect } from 'next/navigation'

export default async function PerfilPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) redirect('/login')

  const payload = await verifyJWT(token)
  if (!payload) redirect('/login')

  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', payload.sub)
    .single()

  if (!user) redirect('/login')

  return <PerfilClient initialUser={user} />
}
