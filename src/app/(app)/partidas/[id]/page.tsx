'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, Users } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Game {
  id: string
  name: string
  category: string | null
  thumbnail_url: string | null
  min_players: number | null
  max_players: number | null
  avg_duration_min: number | null
}

interface Participant {
  status: string
  joined_at: string
  users: {
    id: string
    display_name: string
    avatar_url: string | null
    telegram_username: string | null
  } | null
}

interface SessionDetail {
  id: string
  title: string | null
  description: string | null
  status: string
  location_type: string
  location_details: string | null
  scheduled_date: string
  scheduled_time_start: string | null
  scheduled_time_end: string | null
  min_players: number
  max_players: number
  host_user_id: string
  stored_game_id: string | null
  games: Game | null
  users: { id: string; display_name: string; avatar_url: string | null; telegram_username: string | null } | null
  session_participants: Participant[]
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-900 text-green-300',
  full: 'bg-yellow-900 text-yellow-300',
  confirmed: 'bg-indigo-900 text-indigo-300',
  cancelled: 'bg-red-900 text-red-300',
  completed: 'bg-slate-700 text-slate-300',
}

const PARTICIPANT_STATUS_LABELS: Record<string, string> = {
  confirmed: '✓ Confirmado',
  interested: '👀 Interesado',
  waitlist: '⏳ Lista espera',
  declined: '✗ No puede',
}

export default function PartidaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const qc = useQueryClient()
  const id = params.id as string

  const [cancelConfirm, setCancelConfirm] = useState(false)

  // Get current user from me endpoint
  const { data: me } = useQuery<{ id: string }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
  })

  const { data: session, isLoading } = useQuery<SessionDetail>({
    queryKey: ['session', id],
    queryFn: () => fetch(`/api/sessions/${id}`).then((r) => r.json()),
  })

  const joinMutation = useMutation({
    mutationFn: (status: string) =>
      fetch(`/api/sessions/${id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', id] }),
  })

  const leaveMutation = useMutation({
    mutationFn: () => fetch(`/api/sessions/${id}/leave`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', id] }),
  })

  const cancelMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', id] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="h-48 bg-slate-900 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-4 text-center text-slate-500">
        <p>Partida no encontrada</p>
        <Link href="/partidas" className="text-indigo-400 text-sm mt-2 block">← Volver</Link>
      </div>
    )
  }

  const isHost = me?.id === session.host_user_id
  const myParticipation = session.session_participants.find((p) => p.users?.id === me?.id)
  const statusInfo = STATUS_COLORS[session.status] ?? STATUS_COLORS.open

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Back */}
      <Link href="/partidas" className="flex items-center gap-1 text-slate-400 text-sm hover:text-slate-200">
        <ArrowLeft size={16} /> Partidas
      </Link>

      {/* Header */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h1 className="text-xl font-bold text-white">
              {session.title ?? session.games?.name ?? 'Partida'}
            </h1>
            {session.games?.name && session.title && (
              <p className="text-slate-400 text-sm">{session.games.name}</p>
            )}
          </div>
          <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${statusInfo}`}>
            {session.status === 'open' ? 'Abierta' :
              session.status === 'full' ? 'Completa' :
              session.status === 'confirmed' ? 'Confirmada' :
              session.status === 'cancelled' ? 'Cancelada' : 'Finalizada'}
          </span>
        </div>

        <div className="space-y-1.5 text-sm text-slate-400">
          <p>📅 {format(new Date(session.scheduled_date + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: es })}
            {session.scheduled_time_start && ` · ${session.scheduled_time_start.slice(0, 5)}`}
            {session.scheduled_time_end && `–${session.scheduled_time_end.slice(0, 5)}`}
          </p>
          <p>📍 {session.location_type === 'club' ? 'Club Dragón Madrid' : session.location_type}
            {session.location_details && ` — ${session.location_details}`}
          </p>
          <p><Users size={14} className="inline mr-1" />{session.min_players}–{session.max_players} jugadores</p>
          {session.users && <p>🎮 Host: {session.users.display_name}</p>}
        </div>

        {session.description && (
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">{session.description}</p>
        )}

        {session.stored_game_id && (
          <Link
            href={`/tableros`}
            className="mt-3 block text-xs text-indigo-400 hover:text-indigo-300"
          >
            🗂 Ver tablero almacenado →
          </Link>
        )}
      </div>

      {/* Participants */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <h2 className="font-semibold text-white mb-3">
          Participantes ({session.session_participants.filter((p) => p.status === 'confirmed').length}/{session.max_players})
        </h2>
        <ul className="space-y-2">
          {session.session_participants.map((p, i) => (
            <li key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {p.users?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.users.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-800 flex items-center justify-center text-xs font-bold text-white">
                    {p.users?.display_name?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-white">{p.users?.display_name}</span>
              </div>
              <span className="text-xs text-slate-400">{PARTICIPANT_STATUS_LABELS[p.status] ?? p.status}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      {session.status !== 'cancelled' && session.status !== 'completed' && (
        <div className="space-y-2">
          {isHost ? (
            <>
              {!cancelConfirm ? (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="w-full border border-red-800 text-red-400 hover:bg-red-950 rounded-xl py-2.5 text-sm font-medium"
                >
                  Cancelar partida
                </button>
              ) : (
                <div className="bg-slate-900 rounded-xl p-4 border border-red-900 space-y-3">
                  <p className="text-sm text-white">¿Seguro que quieres cancelar la partida?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCancelConfirm(false)}
                      className="flex-1 bg-slate-800 text-slate-300 rounded-lg py-2 text-sm"
                    >
                      No
                    </button>
                    <button
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                      className="flex-1 bg-red-700 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium"
                    >
                      Sí, cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : myParticipation ? (
            <button
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              className="w-full border border-slate-700 text-slate-300 hover:bg-slate-900 rounded-xl py-2.5 text-sm font-medium"
            >
              Desapuntarme
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => joinMutation.mutate('interested')}
                disabled={joinMutation.isPending}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl py-2.5 text-sm"
              >
                Tengo interés
              </button>
              <button
                onClick={() => joinMutation.mutate('confirmed')}
                disabled={joinMutation.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-medium"
              >
                Me apunto
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
