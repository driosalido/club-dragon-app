'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import PropuestaSheet from './PropuestaSheet'

interface Game {
  id: string
  name: string
  category: string | null
  thumbnail_url: string | null
}

interface SessionUser {
  id: string
  display_name: string
  avatar_url: string | null
}

interface SessionParticipant {
  status: string
}

interface SessionData {
  id: string
  title: string | null
  scheduled_date: string
  scheduled_time_start: string | null
  location_type: string
  min_players: number
  max_players: number
  status: string
  games: Game | null
  users: SessionUser | null
  session_participants: SessionParticipant[]
}

const CATEGORY_COLORS: Record<string, string> = {
  wargame_tablero: 'bg-red-900 text-red-200',
  wargame_figuras: 'bg-orange-900 text-orange-200',
  euros: 'bg-green-900 text-green-200',
  rol: 'bg-purple-900 text-purple-200',
  abstracto: 'bg-blue-900 text-blue-200',
  familiar: 'bg-yellow-900 text-yellow-200',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Abierta', color: 'bg-green-900 text-green-300' },
  full: { label: 'Completa', color: 'bg-yellow-900 text-yellow-300' },
  confirmed: { label: 'Confirmada', color: 'bg-indigo-900 text-indigo-300' },
  cancelled: { label: 'Cancelada', color: 'bg-slate-800 text-slate-400' },
  completed: { label: 'Finalizada', color: 'bg-slate-800 text-slate-400' },
}

const FILTERS = [
  { label: 'Todas', value: '' },
  { label: '★ Mis juegos', value: 'my_games' },
  { label: 'Wargame', value: 'wargame_tablero' },
  { label: 'Euros', value: 'euros' },
  { label: 'Rol', value: 'rol' },
]

export default function PartidasClient() {
  const qc = useQueryClient()
  const [activeFilter, setActiveFilter] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)

  function buildQuery() {
    const params = new URLSearchParams()
    if (activeFilter === 'my_games') params.set('my_games', 'true')
    else if (activeFilter) params.set('category', activeFilter)
    return params.toString()
  }

  const { data: sessions = [], isLoading } = useQuery<SessionData[]>({
    queryKey: ['sessions', activeFilter],
    queryFn: () => fetch(`/api/sessions?${buildQuery()}`).then((r) => r.json()),
  })

  const joinSession = useMutation({
    mutationFn: (sessionId: string) =>
      fetch(`/api/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeFilter === f.value
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Session list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">🎲</p>
          <p className="font-medium">No hay partidas disponibles</p>
          <p className="text-sm mt-1">¡Sé el primero en proponer una!</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => {
            const confirmed = session.session_participants.filter((p) => p.status === 'confirmed').length
            const spotsLeft = session.max_players - confirmed
            const statusInfo = STATUS_LABELS[session.status] ?? STATUS_LABELS.open
            const catColor = CATEGORY_COLORS[session.games?.category ?? ''] ?? 'bg-slate-800 text-slate-300'

            return (
              <li key={session.id} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate">
                        {session.title ?? session.games?.name ?? 'Partida'}
                      </h3>
                      <p className="text-slate-400 text-sm truncate">
                        {session.games?.name}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      {session.games?.category && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${catColor}`}>
                          {session.games.category.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                    <span>
                      📅 {format(new Date(session.scheduled_date + 'T00:00:00'), 'EEE d MMM', { locale: es })}
                      {session.scheduled_time_start && ` · ${session.scheduled_time_start.slice(0, 5)}`}
                    </span>
                    <span>👥 {confirmed}/{session.max_players} ({spotsLeft > 0 ? `${spotsLeft} libre${spotsLeft !== 1 ? 's' : ''}` : 'llena'})</span>
                  </div>

                  {session.users && (
                    <p className="text-xs text-slate-500 mb-3">
                      Host: {session.users.display_name}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href={`/partidas/${session.id}`}
                      className="flex-1 text-center bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg py-1.5 text-sm"
                    >
                      Ver más
                    </Link>
                    {session.status !== 'cancelled' && session.status !== 'completed' && (
                      <button
                        onClick={() => joinSession.mutate(session.id)}
                        disabled={joinSession.isPending}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-1.5 text-sm font-medium"
                      >
                        Me apunto
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-24 right-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-4 shadow-lg z-10"
      >
        <Plus size={24} />
      </button>

      {/* Proposal sheet */}
      {sheetOpen && (
        <PropuestaSheet
          onClose={() => setSheetOpen(false)}
          onCreated={() => {
            setSheetOpen(false)
            qc.invalidateQueries({ queryKey: ['sessions'] })
          }}
        />
      )}
    </div>
  )
}
