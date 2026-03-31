'use client'

import { useState, useRef, useEffect } from 'react'
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

interface BggResult {
  bgg_id: number
  name: string
  year: number | null
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
  const [localResults, setLocalResults] = useState<Game[]>([])
  const [bggResults, setBggResults] = useState<BggResult[]>([])
  const [gameSearching, setGameSearching] = useState(false)
  const [selectedGame, setSelectedGame] = useState<Game | null>(preselectedGame ?? null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step 3
  const [responsable, setResponsable] = useState<UserResult | null>(null)
  const [respSearch, setRespSearch] = useState('')

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.json() as Promise<{ id: string; display_name: string; avatar_url: string | null }>)
      .then((me) => { setResponsable((prev) => prev ?? { id: me.id, display_name: me.display_name, avatar_url: me.avatar_url }) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
    if (!q.trim()) { setLocalResults([]); setBggResults([]); return }
    searchDebounce.current = setTimeout(async () => {
      setGameSearching(true)
      try {
        const [localRes, bggRes] = await Promise.all([
          fetch(`/api/games?q=${encodeURIComponent(q)}`),
          fetch(`/api/games/bgg/search?q=${encodeURIComponent(q)}`),
        ])
        if (localRes.ok) setLocalResults(await localRes.json() as Game[])
        if (bggRes.ok) setBggResults(await bggRes.json() as BggResult[])
      } finally {
        setGameSearching(false)
      }
    }, 300)
  }

  function selectGame(game: Game) {
    setSelectedGame(game)
    setGameSearch(game.name)
    setLocalResults([])
    setBggResults([])
  }

  async function selectBggGame(result: BggResult) {
    setGameSearching(true)
    setLocalResults([])
    setBggResults([])
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: result.name, bgg_id: result.bgg_id }),
      })
      if (res.ok) {
        const game = await res.json() as Game
        setSelectedGame(game)
        setGameSearch(game.name)
      }
    } finally {
      setGameSearching(false)
    }
  }

  async function createAndSelectGame() {
    if (!gameSearch.trim()) return
    setGameSearching(true)
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gameSearch.trim() }),
      })
      if (res.ok) {
        const game = await res.json() as Game
        setSelectedGame(game)
        setLocalResults([])
        setBggResults([])
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
      const allPlayers = [
        { user_id: responsable.id, faction_or_side: undefined },
        ...players
          .filter((p) => p.user.id !== responsable.id)
          .map((p) => ({ user_id: p.user.id, faction_or_side: p.faction_or_side || undefined })),
      ]
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

  const hasResults = localResults.length > 0 || bggResults.length > 0

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
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-1p-ignore="true"
                  data-lpignore="true"
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
                {gameSearching && <p className="text-xs text-slate-500 mt-1">Buscando...</p>}

                {!selectedGame && hasResults && (
                  <ul className="bg-slate-800 border border-slate-700 rounded-lg mt-1 divide-y divide-slate-700 max-h-64 overflow-y-auto">
                    {localResults.map((game) => (
                      <li key={game.id}>
                        <button type="button" onClick={() => selectGame(game)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between">
                          <span>{game.name}</span>
                          <span className="text-xs text-green-500 ml-2 shrink-0">en club</span>
                        </button>
                      </li>
                    ))}
                    {bggResults
                      .filter((b) => !localResults.some((l) => l.name.toLowerCase() === b.name.toLowerCase()))
                      .map((b) => (
                        <li key={b.bgg_id}>
                          <button type="button" onClick={() => selectBggGame(b)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between">
                            <span>{b.name}{b.year ? <span className="text-slate-500 ml-1">({b.year})</span> : null}</span>
                            <span className="text-xs text-indigo-400 ml-2 shrink-0">BGG</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                )}

                {selectedGame && (
                  <p className="text-xs text-green-400 mt-1">✓ {selectedGame.name}</p>
                )}
              </div>

              {selectedGame ? (
                <button
                  onClick={() => setStep(3)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-semibold"
                >
                  Continuar
                </button>
              ) : (
                !gameSearching && gameSearch.trim() && !hasResults && (
                  <button
                    onClick={createAndSelectGame}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-3 font-semibold"
                  >
                    Usar &ldquo;{gameSearch.trim()}&rdquo;
                  </button>
                )
              )}
            </>
          )}

          {/* Step 3: Responsable + players */}
          {step === 3 && (
            <>
              <div className="bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 mb-2">
                <span className="text-white">{selectedGame?.name}</span> · Slot {selectedSlot?.slot_number}
              </div>

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

              <div>
                <label className="block text-xs text-slate-400 mb-1">Notas del escenario (opcional)</label>
                <textarea rows={2} value={scenarioNotes} onChange={(e) => setScenarioNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white resize-none text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha estimada de fin (opcional)</label>
                <input type="date" value={expectedEndDate} min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setExpectedEndDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  onFocus={(e) => e.currentTarget.showPicker?.()}
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
