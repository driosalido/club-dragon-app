'use client'

import { useState, useRef } from 'react'
import { X, Plus, Trash2, ChevronLeft } from 'lucide-react'

interface SlotData {
  id: string
  slot_number: number
  label: string | null
}

interface Game {
  id: string
  name: string
}

interface UserResult {
  id: string
  display_name: string
  avatar_url: string | null
}

interface PlayerEntry {
  user: UserResult
  faction_or_side: string
}

interface Props {
  slots: SlotData[]
  preselectedSlot: SlotData | null
  preselectedGame?: Game | null
  onClose: () => void
  onCreated: () => void
}

export default function NuevoTableroSheet({ slots, preselectedSlot, preselectedGame, onClose, onCreated }: Props) {
  const initialStep = preselectedSlot && preselectedGame ? 3 : preselectedSlot ? 2 : 1
  const [step, setStep] = useState<1 | 2 | 3>(initialStep)

  // Step 1
  const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(preselectedSlot)

  // Step 2
  const [gameSearch, setGameSearch] = useState(preselectedGame?.name ?? '')
  const [gameResults, setGameResults] = useState<Game[]>([])
  const [gameSearching, setGameSearching] = useState(false)
  const [selectedGame, setSelectedGame] = useState<Game | null>(preselectedGame ?? null)
  const [bggId, setBggId] = useState('')
  const [showBggField, setShowBggField] = useState(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 3
  const [responsable, setResponsable] = useState<UserResult | null>(null)
  const [respSearch, setRespSearch] = useState('')
  const [respResults, setRespResults] = useState<UserResult[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<UserResult[]>([])
  const [players, setPlayers] = useState<PlayerEntry[]>([])
  const [scenarioNotes, setScenarioNotes] = useState('')
  const [expectedEndDate, setExpectedEndDate] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleGameInput(q: string) {
    setGameSearch(q)
    setSelectedGame(null)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (!q.trim()) { setGameResults([]); return }
    searchDebounce.current = setTimeout(async () => {
      setGameSearching(true)
      try {
        const res = await fetch(`/api/games?q=${encodeURIComponent(q)}`)
        if (res.ok) setGameResults(await res.json() as Game[])
      } finally {
        setGameSearching(false)
      }
    }, 300)
  }

  function selectGame(game: Game) {
    setSelectedGame(game)
    setGameSearch(game.name)
    setGameResults([])
  }

  async function createAndSelectGame() {
    if (!gameSearch.trim()) return
    setGameSearching(true)
    try {
      const body: Record<string, unknown> = { name: gameSearch.trim() }
      const parsedBgg = bggId.trim() ? parseInt(bggId.trim()) : NaN
      if (!isNaN(parsedBgg) && parsedBgg > 0) body.bgg_id = parsedBgg
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const game = await res.json() as Game
        setSelectedGame(game)
        setGameResults([])
      }
    } finally {
      setGameSearching(false)
    }
  }

  async function searchResponsable(q: string) {
    setRespSearch(q)
    if (!q.trim()) { setRespResults([]); return }
    const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`)
    if (res.ok) setRespResults(await res.json() as UserResult[])
  }

  async function searchUsers(q: string) {
    setUserSearch(q)
    if (!q.trim()) { setUserResults([]); return }
    const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`)
    if (res.ok) setUserResults(await res.json() as UserResult[])
  }

  function addPlayer(user: UserResult) {
    if (players.some((p) => p.user.id === user.id)) return
    setPlayers((prev) => [...prev, { user, faction_or_side: '' }])
    setUserSearch('')
    setUserResults([])
  }

  function removePlayer(userId: string) {
    setPlayers((prev) => prev.filter((p) => p.user.id !== userId))
  }

  function updateFaction(userId: string, faction: string) {
    setPlayers((prev) => prev.map((p) => p.user.id === userId ? { ...p, faction_or_side: faction } : p))
  }

  async function handleSubmit() {
    if (!selectedSlot || !selectedGame || !responsable) return
    setSubmitting(true)
    setError(null)
    try {
      // Build players list: responsable first (always included), then additional
      const additionalIds = new Set(players.map((p) => p.user.id))
      const allPlayers = [
        { user_id: responsable.id, faction_or_side: undefined },
        ...players
          .filter((p) => p.user.id !== responsable.id)
          .map((p) => ({ user_id: p.user.id, faction_or_side: p.faction_or_side || undefined })),
      ]
      void additionalIds
      const res = await fetch('/api/storage/stored-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          game_id: selectedGame.id,
          responsible_user_id: responsable.id,
          players: allPlayers,
          scenario_notes: scenarioNotes || undefined,
          expected_end_date: expectedEndDate || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar el tablero')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
      <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg border-t border-slate-700 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-slate-900 border-b border-slate-800 z-10">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} className="text-slate-400 hover:text-slate-200">
                <ChevronLeft size={20} />
              </button>
            )}
            <h2 className="text-lg font-bold text-white">
              {step === 1 ? 'Seleccionar slot' : step === 2 ? 'Seleccionar juego' : 'Añadir jugadores'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{step}/3</span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Step 1: Select slot */}
          {step === 1 && (
            <>
              {slots.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No hay slots libres disponibles</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => { setSelectedSlot(slot); setStep(2) }}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 text-left transition-colors"
                    >
                      <p className="text-sm font-medium text-white">Slot {slot.slot_number}</p>
                      {slot.label && <p className="text-xs text-slate-400 mt-0.5">{slot.label}</p>}
                      <p className="text-xs text-green-400 mt-2">Disponible</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step 2: Select game */}
          {step === 2 && (
            <>
              <div className="bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 mb-2">
                Slot seleccionado: <span className="text-white">Slot {selectedSlot?.slot_number}{selectedSlot?.label ? ` · ${selectedSlot.label}` : ''}</span>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre del juego</label>
                <input
                  value={gameSearch}
                  onChange={(e) => handleGameInput(e.target.value)}
                  placeholder="Escribe el nombre..."
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
                {gameSearching && <p className="text-xs text-slate-500 mt-1">Buscando...</p>}

                {/* Local DB results */}
                {!selectedGame && gameResults.length > 0 && (
                  <ul className="bg-slate-800 border border-slate-700 rounded-lg mt-1 divide-y divide-slate-700 max-h-48 overflow-y-auto">
                    {gameResults.map((game) => (
                      <li key={game.id}>
                        <button type="button" onClick={() => selectGame(game)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between">
                          <span>{game.name}</span>
                          <span className="text-xs text-green-500 ml-2">en club</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Selected game indicator */}
                {selectedGame && (
                  <p className="text-xs text-green-400 mt-1">✓ {selectedGame.name}</p>
                )}
              </div>

              {/* Optional BGG ID */}
              {!selectedGame && gameSearch.trim() && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowBggField((v) => !v)}
                    className="text-xs text-slate-500 hover:text-slate-300 underline"
                  >
                    {showBggField ? 'Ocultar' : 'Añadir ID de BGG (opcional)'}
                  </button>
                  {showBggField && (
                    <input
                      type="number"
                      value={bggId}
                      onChange={(e) => setBggId(e.target.value)}
                      placeholder="Ej: 37111"
                      className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  )}
                </div>
              )}

              {/* Continue / create button */}
              {selectedGame ? (
                <button
                  onClick={() => setStep(3)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-semibold"
                >
                  Continuar
                </button>
              ) : (
                <button
                  onClick={createAndSelectGame}
                  disabled={!gameSearch.trim() || gameSearching}
                  className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-xl py-3 font-semibold"
                >
                  {gameSearching ? 'Registrando...' : `Usar "${gameSearch.trim() || '…'}"`}
                </button>
              )}
            </>
          )}

          {/* Step 3: Responsable + players */}
          {step === 3 && (
            <>
              <div className="bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 mb-2">
                <span className="text-white">{selectedGame?.name}</span> · Slot {selectedSlot?.slot_number}
              </div>

              {/* Responsable de partida */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Responsable de partida <span className="text-red-400">*</span></label>
                {responsable ? (
                  <div className="flex items-center gap-2 bg-slate-800 border border-indigo-700 rounded-lg px-3 py-2">
                    <span className="text-sm text-white flex-1">{responsable.display_name}</span>
                    <button onClick={() => setResponsable(null)} className="text-slate-500 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={respSearch}
                      onChange={(e) => searchResponsable(e.target.value)}
                      placeholder="Buscar por nombre..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                    {respResults.length > 0 && (
                      <ul className="bg-slate-800 border border-slate-700 rounded-lg mt-1 divide-y divide-slate-700 max-h-36 overflow-y-auto">
                        {respResults.map((u) => (
                          <li key={u.id}>
                            <button type="button"
                              onClick={() => { setResponsable(u); setRespSearch(''); setRespResults([]) }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2">
                              <Plus size={14} className="text-indigo-400" />
                              {u.display_name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>

              {/* Jugadores adicionales */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Jugadores adicionales (opcional)</label>
                <input
                  value={userSearch}
                  onChange={(e) => searchUsers(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
                {userResults.length > 0 && (
                  <ul className="bg-slate-800 border border-slate-700 rounded-lg mt-1 divide-y divide-slate-700 max-h-36 overflow-y-auto">
                    {userResults
                      .filter((u) => u.id !== responsable?.id)
                      .map((u) => (
                        <li key={u.id}>
                          <button type="button" onClick={() => addPlayer(u)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2">
                            <Plus size={14} className="text-indigo-400" />
                            {u.display_name}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
                {players.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {players.map((p) => (
                      <div key={p.user.id} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                        <span className="text-sm text-white flex-shrink-0">{p.user.display_name}</span>
                        <input
                          value={p.faction_or_side}
                          onChange={(e) => updateFaction(p.user.id, e.target.value)}
                          placeholder="Facción/bando"
                          className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white placeholder-slate-500"
                        />
                        <button onClick={() => removePlayer(p.user.id)} className="text-slate-500 hover:text-red-400 flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional fields */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notas del escenario (opcional)</label>
                <textarea rows={2} value={scenarioNotes} onChange={(e) => setScenarioNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white resize-none text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha estimada de fin (opcional)</label>
                <input type="date" value={expectedEndDate} min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setExpectedEndDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
              </div>

              {error && (
                <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-sm text-red-300">{error}</div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || !responsable}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold"
              >
                {submitting ? 'Registrando...' : 'Registrar tablero'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
