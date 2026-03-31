'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Users, TableProperties, ChevronRight } from 'lucide-react'

interface MesaFijaRequest { id: string }

const SECTIONS = [
  {
    href: '/admin/socios',
    icon: Users,
    title: 'Socios',
    description: 'Gestionar miembros, números de socio y permisos',
    color: 'text-indigo-400',
    bg: 'bg-indigo-950/40',
    border: 'border-indigo-900',
  },
  {
    href: '/admin/mesas-fijas',
    icon: TableProperties,
    title: 'Mesas Fijas',
    description: 'Aprobar y gestionar solicitudes de mesa fija',
    color: 'text-green-400',
    bg: 'bg-green-950/40',
    border: 'border-green-900',
    badgeKey: 'mesas-fijas' as const,
  },
]

export default function AdminPage() {
  const router = useRouter()

  const { data: me } = useQuery<{ id: string; is_admin: boolean }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
  })

  const { data: pendingMesas = [] } = useQuery<MesaFijaRequest[]>({
    queryKey: ['admin-mfr-pending'],
    queryFn: () => fetch('/api/storage/mesa-fija-requests?status=pending').then((r) => r.json()),
    enabled: !!me?.is_admin,
  })

  useEffect(() => {
    if (me && !me.is_admin) router.replace('/tableros')
  }, [me, router])

  if (!me) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-900 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!me.is_admin) return null

  const badges: Record<string, number> = {
    'mesas-fijas': pendingMesas.length,
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Administración</h1>
      <p className="text-slate-500 text-sm mb-6">Panel de gestión del Club Dragón</p>

      <div className="space-y-3">
        {SECTIONS.map(({ href, icon: Icon, title, description, color, bg, border, badgeKey }) => {
          const badge = badgeKey ? (badges[badgeKey] ?? 0) : 0
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-4 p-4 rounded-2xl border ${bg} ${border} hover:opacity-90 transition-opacity`}
            >
              <div className={`p-2.5 rounded-xl bg-slate-900 ${color}`}>
                <Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-white">{title}</p>
                  {badge > 0 && (
                    <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 truncate">{description}</p>
              </div>
              <ChevronRight size={18} className="text-slate-600 shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
