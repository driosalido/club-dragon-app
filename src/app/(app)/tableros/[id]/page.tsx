'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Game {
  id: string; name: string; category: string | null; thumbnail_url: string | null
}

interface StoredGamePlayer {
  user_id: string; faction_or_side: string | null
  users: { id: string; display_name: string; avatar_url: string | null } | null
}

interface StoredGameSession {
  id: string; session_date: string; duration_minutes: number | null
  state_after_session: string | null; next_turn_info: string | null; created_at: string
}

interface UserSearchResult {
  id: string
  display_name: string
  avatar_url: string | null
}

interface EditablePlayer {
  user_id: string
  display_name: string
  faction_or_side: string
}

interface StoredGameDetail {
  id: string; status: string; turn_info: string | null; current_state_notes: string | null
  scenario_notes: string | null; last_session_at: string; days_since_last: number | null
  game_id: string | null; slot_id: string | null; responsible_user_id: string | null
  games: Game | null
  storage_slots: { id: string; slot_number: number; label: string | null } | null
  responsible_user: { id: string; display_name: string; avatar_url: string | null } | null
  players: StoredGamePlayer[]
  sessions: StoredGameSession[]
}

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  active: { color: 'bg-green-900 text-green-300', label: '🟢 Activo' },
  warning: { color: 'bg-yellow-900 text-yellow-300', label: '🟡 Aviso' },
  critical: { color: 'bg-red-900 text-red-300', label: '🔴 Crítico' },
  expired: { color: 'bg-red-900 text-red-200', label: '💀 Expirado' },
  completed: { color: 'bg-slate-700 text-slate-300', label: '✅ Completado' },
  evicted: { color: 'bg-slate-700 text-slate-400', label: '🗑 Retirado' },
}

export default function TableroDetailPage() {
  const params = useParams()
  const qc = useQueryClient()
  const id = params.id as string

  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [finishConfirm, setFinishConfirm] = useState(false)
  const [evictConfirm, setEvictConfirm] = useState(false)
  const [editingPlayers, setEditingPlayers] = useState(false)
  const [playersDraft, setPlayersDraft] = useState<EditablePlayer[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<UserSearchResult[]>([])
  const [playersError, setPlayersError] = useState<string | null>(null)
  const [sessionForm, setSessionForm] = useState({
    session_date: new Date().toISOString().slice(0, 10),
    duration_minutes: '',
    state_after_session: '',
    next_turn_info: '',
  })

  const { data: me } = useQuery<{ id: string; is_admin: boolean }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
  })

  const { data: game, isLoading } = useQuery<StoredGameDetail>({
    queryKey: ['stored-game', id],
    queryFn: () => fetch(`/api/storage/stored-games/${id}`).then((r) => r.json()),
  })

  const isPlayer = me && game?.players.some((p) => p.user_id === me.id)
  const canManagePlayers = !!me && !!game && (me.is_admin || game.responsible_user_id === me.id)

  const logSession = useMutation({
    mutationFn: (data: typeof sessionForm) =>
      fetch(`/api/storage/stored-games/${id}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes) : undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stored-game', id] })
      qc.invalidateQueries({ queryKey: ['slots'] })
      setSessionModalOpen(false)
    },
  })

  const finishGame = useMutation({
    mutationFn: () => fetch(`/api/storage/stored-games/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stored-game', id] }),
  })

  const evictGame = useMutation({
    mutationFn: () =>
      fetch(`/api/storage/stored-games/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'evicted' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stored-game', id] }),
  })

  const updatePlayers = useMutation({
    mutationFn: (players: EditablePlayer[]) =>
      fetch(`/api/storage/stored-games/${id}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players: players.map((p) => ({
            user_id: p.user_id,
            faction_or_side: p.faction_or_side.trim() || undefined,
          })),
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? 'No se pudieron actualizar los jugadores')
        }
      }),
    onSuccess: () => {
      setEditingPlayers(false)
      setPlayersError(null)
      setUserSearch('')
      setUserResults([])
      qc.invalidateQueries({ queryKey: ['stored-game', id] })
      qc.invalidateQueries({ queryKey: ['slots'] })
    },
    onError: (e) => {
      setPlayersError(e instanceof Error ? e.message : 'No se pudieron actualizar los jugadores')
    },
  })

  function startEditPlayers() {
    if (!game) return
    setPlayersError(null)
    setEditingPlayers(true)
    setPlayersDraft(
      game.players.map((p) => ({
        user_id: p.user_id,
        display_name: p.users?.display_name ?? 'Desconocido',
        faction_or_side: p.faction_or_side ?? '',
      }))
    )
  }

  async function searchUsers(q: string) {
    setUserSearch(q)
    if (!q.trim()) {
      setUserResults([])
      return
    }
    const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      const data = await res.json() as UserSearchResult[]
      setUserResults(data)
    }
  }

  function addPlayer(user: UserSearchResult) {
    if (playersDraft.some((p) => p.user_id === user.id)) return
    setPlayersDraft((prev) => [
      ...prev,
      { user_id: user.id, display_name: user.display_name, faction_or_side: '' },
    ])
    setUserSearch('')
    setUserResults([])
  }

  function removePlayer(userId: string) {
    if (game?.responsible_user_id === userId) {
      setPlayersError('El responsable de la partida debe permanecer en la lista de jugadores.')
      return
    }
    setPlayersError(null)
    setPlayersDraft((prev) => prev.filter((p) => p.user_id !== userId))
  }

  function updateFaction(userId: string, faction: string) {
    setPlayersDraft((prev) =>
      prev.map((p) => (p.user_id === userId ? { ...p, faction_or_side: faction } : p))
    )
  }

  if (isLoading) return <div className="p-4"><div className="h-48 bg-slate-900 rounded-xl animate-pulse" /></div>
  if (!game) return <div className="p-4 text-slate-500 text-center">Tablero no encontrado<br /><Link href="/tableros" className="text-indigo-400 text-sm">← Volver</Link></div>

  const badgeInfo = STATUS_BADGE[game.status] ?? STATUS_BADGE.active
  const isAlert = ['critical', 'expired'].includes(game.status)

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <Link href="/tableros" className="flex items-center gap-1 text-slate-400 text-sm hover:text-slate-200">
        <ArrowLeft size={16} /> Tableros
      </Link>

      {/* Alert banner */}
      {isAlert && (
        <div className="bg-red-950 border border-red-700 rounded-xl p-3 text-sm text-red-200">
          {game.status === 'expired'
            ? `💀 Tablero expirado: ${game.days_since_last} días sin jugar. Contacta con un admin.`
            : `🔴 Crítico: ${game.days_since_last} días sin jugar. ¡Registra sesión urgente!`}
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-white">{game.games?.name ?? 'Juego desconocido'}</h1>
            {game.storage_slots && (
              <p className="text-slate-400 text-sm">
                Slot {game.storage_slots.slot_number}{game.storage_slots.label ? ` · ${game.storage_slots.label}` : ''}
              </p>
            )}
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${badgeInfo.color}`}>{badgeInfo.label}</span>
        </div>

        {game.days_since_last !== null && (
          <p className="text-slate-400 text-sm">⏱ Última sesión hace {game.days_since_last} días</p>
        )}
      </div>

      {/* Current state */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3">
        <h2 className="font-semibold text-white">Estado actual</h2>
        {game.turn_info && <div><p className="text-xs text-slate-500 mb-1">A quién le toca</p><p className="text-sm text-slate-200">{game.turn_info}</p></div>}
        {game.current_state_notes && <div><p className="text-xs text-slate-500 mb-1">Notas del estado</p><p className="text-sm text-slate-200">{game.current_state_notes}</p></div>}
        {game.scenario_notes && <div><p className="text-xs text-slate-500 mb-1">Escenario</p><p className="text-sm text-slate-200">{game.scenario_notes}</p></div>}

        {game.responsible_user && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Responsable de partida</p>
            <div className="flex items-center gap-1.5 bg-indigo-950 border border-indigo-800 rounded-full px-2.5 py-1 w-fit">
              <span className="text-xs font-medium text-indigo-200">{game.responsible_user.display_name}</span>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500">Jugadores</p>
            {canManagePlayers && !editingPlayers && (
              <button
                onClick={startEditPlayers}
                className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200"
              >
                <Pencil size={12} />
                Editar
              </button>
            )}
          </div>

          {!editingPlayers ? (
            <div className="flex flex-wrap gap-2">
              {game.players.map((p) => (
                <div key={p.user_id} className="flex items-center gap-1.5 bg-slate-800 rounded-full px-2 py-1">
                  <span className="text-xs text-white">{p.users?.display_name ?? '?'}</span>
                  {p.faction_or_side && <span className="text-xs text-slate-500">({p.faction_or_side})</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={userSearch}
                onChange={(e) => searchUsers(e.target.value)}
                placeholder="Buscar usuario para añadir..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
              {userResults.length > 0 && (
                <ul className="bg-slate-800 border border-slate-700 rounded-lg divide-y divide-slate-700 max-h-32 overflow-y-auto">
                  {userResults.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => addPlayer(u)}
                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Plus size={12} className="text-indigo-400" />
                        {u.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-2">
                {playersDraft.map((p) => (
                  <div key={p.user_id} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                    <span className="text-sm text-white min-w-0 flex-1 truncate">{p.display_name}</span>
                    <input
                      value={p.faction_or_side}
                      onChange={(e) => updateFaction(p.user_id, e.target.value)}
                      placeholder="Facción/bando"
                      className="w-32 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                    />
                    <button
                      onClick={() => removePlayer(p.user_id)}
                      className="text-slate-500 hover:text-red-400"
                      title="Quitar jugador"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {playersError && (
                <p className="text-xs text-red-400">{playersError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setEditingPlayers(false)
                    setPlayersError(null)
                    setUserSearch('')
                    setUserResults([])
                  }}
                  className="flex-1 bg-slate-800 text-slate-300 rounded-lg py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => updatePlayers.mutate(playersDraft)}
                  disabled={updatePlayers.isPending || playersDraft.length === 0}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium"
                >
                  {updatePlayers.isPending ? 'Guardando...' : 'Guardar jugadores'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session history */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <h2 className="font-semibold text-white mb-3">Historial de sesiones</h2>
        {game.sessions.length === 0 ? (
          <p className="text-slate-500 text-sm">Sin sesiones registradas</p>
        ) : (
          <ul className="space-y-2">
            {game.sessions.map((s) => (
              <li key={s.id} className="border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white">{format(new Date(s.session_date + 'T00:00:00'), 'd MMM yyyy', { locale: es })}</span>
                  {s.duration_minutes && <span className="text-slate-500">{s.duration_minutes} min</span>}
                </div>
                {s.state_after_session && <p className="text-xs text-slate-400 mt-0.5 truncate">{s.state_after_session}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      {['active', 'warning', 'critical'].includes(game.status) && (
        <div className="space-y-2">
          {isPlayer && (
            <button
              onClick={() => setSessionModalOpen(true)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-semibold"
            >
              Registrar sesión de hoy
            </button>
          )}

          {isPlayer && !finishConfirm && (
            <button
              onClick={() => setFinishConfirm(true)}
              className="w-full border border-slate-700 text-slate-300 rounded-xl py-2.5 text-sm"
            >
              Finalizar partida
            </button>
          )}
          {finishConfirm && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
              <p className="text-sm text-white">¿Finalizar la partida? El slot quedará libre.</p>
              <div className="flex gap-2">
                <button onClick={() => setFinishConfirm(false)} className="flex-1 bg-slate-800 text-slate-300 rounded-lg py-2 text-sm">No</button>
                <button onClick={() => finishGame.mutate()} className="flex-1 bg-green-700 hover:bg-green-600 text-white rounded-lg py-2 text-sm font-medium">Sí, finalizar</button>
              </div>
            </div>
          )}

          {me?.is_admin && !evictConfirm && (
            <button
              onClick={() => setEvictConfirm(true)}
              className="w-full border border-red-900 text-red-400 rounded-xl py-2.5 text-sm"
            >
              Forzar retirada (admin)
            </button>
          )}
          {evictConfirm && (
            <div className="bg-slate-900 border border-red-900 rounded-xl p-4 space-y-3">
              <p className="text-sm text-white">¿Forzar la retirada del tablero?</p>
              <div className="flex gap-2">
                <button onClick={() => setEvictConfirm(false)} className="flex-1 bg-slate-800 text-slate-300 rounded-lg py-2 text-sm">No</button>
                <button onClick={() => evictGame.mutate()} className="flex-1 bg-red-700 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Sí, retirar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log session modal */}
      {sessionModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-4 border-t border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Registrar sesión</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha</label>
                <input type="date" value={sessionForm.session_date}
                  onChange={(e) => setSessionForm((f) => ({ ...f, session_date: e.target.value }))}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  onFocus={(e) => e.currentTarget.showPicker?.()}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Duración (min)</label>
                <input type="number" value={sessionForm.duration_minutes}
                  onChange={(e) => setSessionForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Estado después de la sesión</label>
                <textarea rows={2} value={sessionForm.state_after_session}
                  onChange={(e) => setSessionForm((f) => ({ ...f, state_after_session: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white resize-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">A quién le toca ahora</label>
                <input value={sessionForm.next_turn_info}
                  onChange={(e) => setSessionForm((f) => ({ ...f, next_turn_info: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setSessionModalOpen(false)} className="flex-1 bg-slate-800 text-slate-300 rounded-lg py-2.5 text-sm">Cancelar</button>
                <button
                  onClick={() => logSession.mutate(sessionForm)}
                  disabled={logSession.isPending}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium"
                >
                  {logSession.isPending ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
