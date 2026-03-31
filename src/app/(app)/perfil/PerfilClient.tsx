'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, LogOut } from 'lucide-react'
import type { Tables } from '@/types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type User = Tables<'users'>

interface Game {
  id: string
  name: string
  category: string | null
  thumbnail_url: string | null
}

interface UserGame {
  interest_level: 'want_to_play' | 'own_and_teach' | 'learning'
  notes: string | null
  games: Game | null
}

const INTEREST_LABELS = {
  want_to_play: 'Quiero jugar',
  own_and_teach: 'Lo tengo y enseño',
  learning: 'Aprendiendo',
}

const INTEREST_COLORS = {
  want_to_play: 'bg-blue-900 text-blue-200',
  own_and_teach: 'bg-green-900 text-green-200',
  learning: 'bg-yellow-900 text-yellow-200',
}

// Mon → Sun display order; day_of_week: Mon=1…Sat=6, Sun=0
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABELS: Record<number, string> = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' }
const MORNING = { time_start: '09:00', time_end: '14:00' }
const AFTERNOON = { time_start: '16:00', time_end: '21:00' }

interface AvailabilitySlot {
  id: string
  day_of_week: number
  time_start: string | null
  time_end: string | null
}

type SlotKey = `${number}_m` | `${number}_t`

function slotsToKeys(slots: AvailabilitySlot[]): Set<SlotKey> {
  return new Set(slots.map((a) => {
    const period = (!a.time_start || a.time_start < '15:00') ? 'm' : 't'
    return `${a.day_of_week}_${period}` as SlotKey
  }))
}

function keysToPayload(keys: Set<SlotKey>) {
  return [...keys].map((key) => {
    const [day, period] = key.split('_')
    return {
      day_of_week: parseInt(day!),
      ...(period === 'm' ? MORNING : AFTERNOON),
    }
  })
}

interface Props {
  initialUser: User
}

export default function PerfilClient({ initialUser }: Props) {
  const qc = useQueryClient()
  const router = useRouter()
  const [editingAvailability, setEditingAvailability] = useState(false)
  const [draftSlots, setDraftSlots] = useState<Set<SlotKey>>(new Set())
  const [gameSearchOpen, setGameSearchOpen] = useState(false)
  const [gameSearch, setGameSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Game[]>([])
  const [interestModal, setInterestModal] = useState<{ game: Game } | null>(null)
  const [editModal, setEditModal] = useState<{ game_id: string; game: Game; interest_level: string; notes: string | null } | null>(null)

  const { data: user = initialUser } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
    initialData: initialUser,
  })

  const { data: games = [] } = useQuery<UserGame[]>({
    queryKey: ['my-games'],
    queryFn: () => fetch('/api/users/me/games').then((r) => r.json()),
  })

  const { data: availability = [] } = useQuery<AvailabilitySlot[]>({
    queryKey: ['my-availability'],
    queryFn: () => fetch('/api/users/me/availability').then((r) => r.json()),
  })

  const addGame = useMutation({
    mutationFn: (vars: { game_id: string; interest_level: string }) =>
      fetch('/api/users/me/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-games'] }),
  })

  const updateGame = useMutation({
    mutationFn: (vars: { game_id: string; interest_level: string; notes: string | null }) =>
      fetch(`/api/users/me/games/${vars.game_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest_level: vars.interest_level, notes: vars.notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-games'] }),
  })

  const deleteGame = useMutation({
    mutationFn: (game_id: string) =>
      fetch(`/api/users/me/games/${game_id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-games'] }),
  })

  const saveAvailability = useMutation({
    mutationFn: (keys: Set<SlotKey>) =>
      fetch('/api/users/me/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keysToPayload(keys)),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-availability'] })
      setEditingAvailability(false)
    },
  })

  async function searchGames(q: string) {
    if (!q.trim()) { setSearchResults([]); return }
    const res = await fetch(`/api/games?q=${encodeURIComponent(q)}`)
    if (res.ok) setSearchResults(await res.json())
  }

  const activeDays = availability.map((a) => a.day_of_week)

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-indigo-800 flex items-center justify-center text-2xl font-bold text-white">
            {user.display_name?.[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-white">{user.display_name}</h1>
          {user.telegram_username && (
            <p className="text-slate-400 text-sm">@{user.telegram_username}</p>
          )}
          <p className="text-slate-500 text-xs">
            Socio desde {format(new Date(user.created_at), 'MMMM yyyy', { locale: es })}
          </p>
          {user.member_number && (
            <p className="mt-1 text-xs text-indigo-400">Socio #{user.member_number}</p>
          )}
        </div>
      </div>

      {user.bio && (
        <p className="text-slate-300 text-sm">{user.bio}</p>
      )}

      {/* Games */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Mis juegos</h2>
          <button
            onClick={() => setGameSearchOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg p-1.5"
          >
            <Plus size={18} />
          </button>
        </div>

        {games.length === 0 ? (
          <p className="text-slate-500 text-sm">No tienes juegos añadidos aún.</p>
        ) : (
          <ul className="space-y-2">
            {games.map(({ games: game, interest_level, notes }) => {
              if (!game) return null
              return (
                <li
                  key={game.id}
                  className="flex items-center justify-between bg-slate-900 rounded-xl px-3 py-2.5"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-white text-sm font-medium truncate">{game.name}</span>
                    <div className="flex items-center gap-2">
                      {game.category && (
                        <span className="text-slate-500 text-xs">{game.category}</span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${INTEREST_COLORS[interest_level]}`}>
                        {INTEREST_LABELS[interest_level]}
                      </span>
                    </div>
                    {notes && <span className="text-slate-500 text-xs truncate">{notes}</span>}
                  </div>
                  <button
                    onClick={() => setEditModal({ game_id: game.id, game, interest_level, notes })}
                    className="text-slate-500 hover:text-slate-300 ml-2 shrink-0"
                  >
                    <Pencil size={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Availability */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Disponibilidad</h2>
          <button
            onClick={() => {
              setDraftSlots(slotsToKeys(availability))
              setEditingAvailability((v) => !v)
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            {editingAvailability ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        {(() => {
          const activeKeys = slotsToKeys(availability)
          const toggle = (key: SlotKey) =>
            setDraftSlots((prev) => {
              const next = new Set(prev)
              next.has(key) ? next.delete(key) : next.add(key)
              return next
            })
          const current = editingAvailability ? draftSlots : activeKeys

          return (
            <div className="grid grid-cols-8 gap-1">
              {/* Header row */}
              <div />
              {DAY_ORDER.map((day) => (
                <div key={day} className="text-xs text-center text-slate-400 pb-1 font-medium">
                  {DAY_LABELS[day]}
                </div>
              ))}
              {/* Mañana */}
              <div className="text-xs text-slate-500 flex items-center">Mañana</div>
              {DAY_ORDER.map((day) => {
                const key = `${day}_m` as SlotKey
                const active = current.has(key)
                return (
                  <button
                    key={key}
                    disabled={!editingAvailability}
                    onClick={() => toggle(key)}
                    className={`py-2 rounded transition-colors ${
                      active ? 'bg-indigo-600' : 'bg-slate-800'
                    } ${editingAvailability ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                  />
                )
              })}
              {/* Tarde */}
              <div className="text-xs text-slate-500 flex items-center">Tarde</div>
              {DAY_ORDER.map((day) => {
                const key = `${day}_t` as SlotKey
                const active = current.has(key)
                return (
                  <button
                    key={key}
                    disabled={!editingAvailability}
                    onClick={() => toggle(key)}
                    className={`py-2 rounded transition-colors ${
                      active ? 'bg-indigo-500' : 'bg-slate-800'
                    } ${editingAvailability ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                  />
                )
              })}
            </div>
          )
        })()}

        {editingAvailability && (
          <button
            onClick={() => saveAvailability.mutate(draftSlots)}
            disabled={saveAvailability.isPending}
            className="mt-3 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium"
          >
            {saveAvailability.isPending ? 'Guardando...' : 'Guardar disponibilidad'}
          </button>
        )}
      </section>

      {/* Logout */}
      <button
        onClick={async () => {
          await fetch('/api/auth/logout', { method: 'POST' })
          qc.clear()
          router.push('/login')
        }}
        className="flex items-center gap-2 text-slate-500 hover:text-red-400 text-sm py-2 transition-colors"
      >
        <LogOut size={15} />
        Cerrar sesión
      </button>

      {/* Game search modal */}
      {gameSearchOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
          <div className="bg-slate-900 rounded-t-2xl p-4 w-full max-w-lg border-t border-slate-800">
            <h3 className="text-lg font-bold text-white mb-3">Añadir juego</h3>
            <input
              autoFocus
              value={gameSearch}
              onChange={(e) => { setGameSearch(e.target.value); searchGames(e.target.value) }}
              placeholder="Buscar juego..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 mb-3"
            />
            {searchResults.length > 0 && (
              <ul className="divide-y divide-slate-800 max-h-56 overflow-y-auto">
                {searchResults.map((game) => (
                  <li key={game.id}>
                    <button
                      onClick={() => { setInterestModal({ game }); setGameSearchOpen(false) }}
                      className="w-full text-left px-2 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
                    >
                      {game.name}
                      {game.category && (
                        <span className="ml-2 text-xs text-slate-500">{game.category}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => { setGameSearchOpen(false); setSearchResults([]) }}
              className="mt-3 w-full text-slate-500 text-sm py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Interest level modal (add) */}
      {interestModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-5 w-full max-w-sm border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-1">{interestModal.game.name}</h3>
            <p className="text-slate-400 text-sm mb-4">¿Cuál es tu nivel de interés?</p>
            <div className="flex flex-col gap-2">
              {(Object.entries(INTEREST_LABELS) as [keyof typeof INTEREST_LABELS, string][]).map(
                ([level, label]) => (
                  <button
                    key={level}
                    onClick={() => {
                      addGame.mutate({ game_id: interestModal.game.id, interest_level: level })
                      setInterestModal(null)
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg py-2.5 px-4 text-sm text-left"
                  >
                    {label}
                  </button>
                )
              )}
            </div>
            <button onClick={() => setInterestModal(null)} className="mt-3 w-full text-slate-500 text-sm py-2">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Edit game modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-5 w-full max-w-sm border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-3">{editModal.game.name}</h3>
            <div className="flex flex-col gap-2 mb-3">
              {(Object.entries(INTEREST_LABELS) as [keyof typeof INTEREST_LABELS, string][]).map(
                ([level, label]) => (
                  <button
                    key={level}
                    onClick={() => {
                      updateGame.mutate({ game_id: editModal.game_id, interest_level: level, notes: editModal.notes })
                      setEditModal(null)
                    }}
                    className={`rounded-lg py-2.5 px-4 text-sm text-left ${
                      editModal.interest_level === level
                        ? 'bg-indigo-700 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
            <button
              onClick={() => {
                deleteGame.mutate(editModal.game_id)
                setEditModal(null)
              }}
              className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 text-sm py-2 border border-red-900 rounded-lg"
            >
              <Trash2 size={14} /> Eliminar del perfil
            </button>
            <button onClick={() => setEditModal(null)} className="mt-2 w-full text-slate-500 text-sm py-2">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
