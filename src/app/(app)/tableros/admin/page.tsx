'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface StoredGameRow {
  id: string
  status: string
  last_session_at: string
  days_since_last: number | null
  games: { id: string; name: string } | null
  storage_slots: { slot_number: number; label: string | null } | null
  players: { user_id: string; users?: { display_name: string } | null }[]
}

interface Stats {
  total_slots: number
  occupied_slots: number
  free_slots: number
  avg_session_duration_min: number
  most_stored_game_id: string | null
}

const STATUS_LABEL: Record<string, string> = {
  active: '🟢 Activo',
  warning: '🟡 Aviso',
  critical: '🔴 Crítico',
  expired: '💀 Expirado',
  completed: '✅ Completado',
  evicted: '🗑 Retirado',
}

const STATUS_COLOR: Record<string, string> = {
  active: 'text-green-400',
  warning: 'text-yellow-400',
  critical: 'text-red-400',
  expired: 'text-red-300',
  completed: 'text-slate-400',
  evicted: 'text-slate-500',
}

export default function TablerosAdminPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [showHistory, setShowHistory] = useState(false)

  const { data: me } = useQuery<{ id: string; is_admin: boolean }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
  })

  useEffect(() => {
    if (me && !me.is_admin) {
      router.replace('/tableros')
    }
  }, [me, router])

  const { data: games = [], isLoading } = useQuery<StoredGameRow[]>({
    queryKey: ['admin-stored-games', statusFilter],
    queryFn: () =>
      fetch(`/api/storage/stored-games?status=${statusFilter}`)
        .then((r) => r.json()),
    enabled: !!me?.is_admin,
  })

  const { data: history = [] } = useQuery<StoredGameRow[]>({
    queryKey: ['admin-stored-games-history'],
    queryFn: () =>
      fetch('/api/storage/stored-games?status=completed')
        .then((r) => r.json())
        .then(async (completed: StoredGameRow[]) => {
          const evicted = await fetch('/api/storage/stored-games?status=evicted').then((r) => r.json()) as StoredGameRow[]
          return [...completed, ...evicted]
        }),
    enabled: !!me?.is_admin && showHistory,
  })

  const { data: stats } = useQuery<Stats>({
    queryKey: ['storage-stats'],
    queryFn: () => fetch('/api/storage/stats').then((r) => r.json()),
    enabled: !!me?.is_admin,
  })

  const evict = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/storage/stored-games/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'evicted' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-stored-games'] })
      qc.invalidateQueries({ queryKey: ['slots'] })
    },
  })

  const [evictConfirm, setEvictConfirm] = useState<string | null>(null)

  if (!me) return <div className="p-4"><div className="h-48 bg-slate-900 rounded-xl animate-pulse" /></div>
  if (!me.is_admin) return null

  const activeStatuses = ['active', 'warning', 'critical', 'expired']

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <Link href="/tableros" className="flex items-center gap-1 text-slate-400 text-sm hover:text-slate-200">
        <ArrowLeft size={16} /> Tableros
      </Link>

      <h1 className="text-2xl font-bold text-white">Admin · Tableros</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
            <p className="text-xs text-slate-500 mb-1">Ocupación</p>
            <p className="text-xl font-bold text-white">{stats.occupied_slots}/{stats.total_slots}</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
            <p className="text-xs text-slate-500 mb-1">Libres</p>
            <p className="text-xl font-bold text-green-400">{stats.free_slots}</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
            <p className="text-xs text-slate-500 mb-1">Avg sesión</p>
            <p className="text-xl font-bold text-white">{stats.avg_session_duration_min || '—'}{stats.avg_session_duration_min ? ' min' : ''}</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
            <p className="text-xs text-slate-500 mb-1">Ocupación %</p>
            <p className="text-xl font-bold text-white">
              {stats.total_slots > 0 ? Math.round(stats.occupied_slots / stats.total_slots * 100) : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {activeStatuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Games table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-4"><div className="h-32 bg-slate-800 rounded animate-pulse" /></div>
        ) : games.length === 0 ? (
          <p className="p-4 text-slate-500 text-sm text-center">No hay tableros con este estado</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {games.map((g) => (
              <div key={g.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${STATUS_COLOR[g.status] ?? 'text-slate-400'}`}>
                        {STATUS_LABEL[g.status] ?? g.status}
                      </span>
                      {g.storage_slots && (
                        <span className="text-xs text-slate-500">
                          Slot {g.storage_slots.slot_number}{g.storage_slots.label ? ` · ${g.storage_slots.label}` : ''}
                        </span>
                      )}
                    </div>
                    <Link href={`/tableros/${g.id}`} className="text-white font-medium hover:text-indigo-400 truncate block">
                      {g.games?.name ?? 'Juego desconocido'}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {g.days_since_last !== null ? `${g.days_since_last}d sin jugar` : ''}
                      {g.players.length > 0 ? ` · ${g.players.map((p) => p.users?.display_name ?? '?').join(', ')}` : ''}
                    </p>
                  </div>

                  {['critical', 'expired'].includes(g.status) && (
                    <div>
                      {evictConfirm === g.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEvictConfirm(null)}
                            className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded"
                          >
                            No
                          </button>
                          <button
                            onClick={() => { evict.mutate(g.id); setEvictConfirm(null) }}
                            className="text-xs bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded font-medium"
                          >
                            Retirar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEvictConfirm(g.id)}
                          className="text-xs border border-red-900 text-red-400 px-2 py-1 rounded hover:bg-red-950 transition-colors"
                        >
                          Forzar retirada
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History section */}
      <div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          {showHistory ? '▲ Ocultar historial' : '▼ Ver historial (completados y retirados)'}
        </button>
        {showHistory && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mt-3">
            {history.length === 0 ? (
              <p className="p-4 text-slate-500 text-sm text-center">Sin historial</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {history.map((g) => (
                  <div key={g.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{g.games?.name ?? '?'}</p>
                      <p className="text-xs text-slate-500">
                        {STATUS_LABEL[g.status]} · Slot {g.storage_slots?.slot_number} ·{' '}
                        {format(new Date(g.last_session_at), 'd MMM yyyy', { locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
